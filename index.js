'use strict';

const BpmnModdle = require('bpmn-moddle');
const DebugLogger = require('./lib/Logger');
const elements = require('bpmn-elements');
const getOptionsAndCallback = require('./lib/getOptionsAndCallback');
const JavaScripts = require('./lib/JavaScripts');
const ProcessOutputDataObject = require('./lib/extensions/ProcessOutputDataObject');
const {Broker} = require('smqp');
const {default: serializer, deserialize, TypeResolver} = require('moddle-context-serializer');
const {EventEmitter} = require('events');
const {version: engineVersion} = require('./package.json');

module.exports = {Engine};

function Engine(options = {}) {
  options = {Logger: DebugLogger, scripts: JavaScripts(), ...options};

  let {name, Logger} = options;

  let loadedDefinitions, execution;
  const logger = Logger('engine');

  const sources = [];
  const typeResolver = TypeResolver({
    ...elements,
    ...(options.elements || {})
  }, defaultTypeResolver);

  function defaultTypeResolver(elementTypes) {
    if (options.typeResolver) return options.typeResolver(elementTypes);
    elementTypes['bpmn:DataObject'] = ProcessOutputDataObject;
  }

  const pendingSources = [];
  if (options.source) pendingSources.push(serializeSource(options.source));
  if (options.moddleContext) pendingSources.push(serializeModdleContext(options.moddleContext));

  let environment = elements.Environment(options);
  const emitter = new EventEmitter();

  const engine = Object.assign(emitter, {
    execute,
    logger,
    getDefinitionById,
    getDefinitions,
    getState,
    recover,
    resume,
    stop,
    waitFor,
  });

  const broker = Broker(engine);
  broker.assertExchange('event', 'topic', {autoDelete: false});

  Object.defineProperty(engine, 'broker', {
    enumerable: true,
    get() {
      return broker;
    }
  });

  Object.defineProperty(engine, 'name', {
    enumerable: true,
    get() {
      return name;
    },
    set(value) {
      name = value;
    },
  });

  Object.defineProperty(engine, 'environment', {
    enumerable: true,
    get() {
      return environment;
    },
  });

  Object.defineProperty(engine, 'state', {
    enumerable: true,
    get() {
      if (execution) return execution.state;
      return 'idle';
    },
  });

  Object.defineProperty(engine, 'stopped', {
    enumerable: true,
    get() {
      if (execution) return execution.stopped;
      return false;
    },
  });

  Object.defineProperty(engine, 'execution', {
    enumerable: true,
    get() {
      return execution;
    },
  });

  return engine;

  async function execute(...args) {
    const [executeOptions, callback] = getOptionsAndCallback(...args);
    let runSources;
    try {
      runSources = await Promise.all(pendingSources);
    } catch (err) {
      if (callback) return callback(err);
      throw err;
    }
    const definitions = runSources.map((source) => loadDefinition(source, executeOptions));
    execution = Execution(engine, definitions, options);
    return execution.execute(executeOptions, callback);
  }

  async function stop() {
    if (!execution) return;
    return execution.stop();
  }

  function recover(savedState, recoverOptions) {
    if (!savedState) return engine;

    logger.debug(`<${name}> recover`);

    if (!name) name = savedState.name;
    if (recoverOptions) environment = elements.Environment(recoverOptions);
    if (savedState.environment) environment = environment.recover(savedState.environment);

    if (!savedState.definitions) return engine;

    loadedDefinitions = savedState.definitions.map((dState) => {
      const source = deserialize(JSON.parse(dState.source), typeResolver);

      logger.debug(`<${name}> recover ${dState.type} <${dState.id}>`);

      const definition = loadDefinition(source);
      definition.recover(dState);

      return definition;
    });

    return engine;
  }

  async function resume(...args) {
    const [resumeOptions, callback] = getOptionsAndCallback(...args);

    if (!execution) {
      const definitions = await getDefinitions();
      execution = Execution(engine, definitions, options);
    }

    return execution.resume(resumeOptions, callback);
  }

  async function getDefinitions(executeOptions) {
    if (loadedDefinitions && loadedDefinitions.length) return loadedDefinitions;
    return Promise.all(pendingSources).then((srcs) => srcs.map((src) => loadDefinition(src, executeOptions)));
  }

  async function getDefinitionById(id) {
    return (await getDefinitions()).find((d) => d.id === id);
  }

  async function getState() {
    if (execution) return execution.getState();

    const definitions = await getDefinitions();
    return Execution(engine, definitions, options).getState();
  }

  function loadDefinition(serializedContext, executeOptions) {
    const context = elements.Context(serializedContext, environment.clone({
      listener: environment.options.listener,
      ...executeOptions,
      source: serializedContext,
    }));

    return elements.Definition(context);
  }

  async function serializeSource(source) {
    const moddleContext = await getModdleContext(source);
    return serializeModdleContext(moddleContext);
  }

  function serializeModdleContext(moddleContext) {
    const serialized = serializer(moddleContext, typeResolver);
    sources.push(serialized);
    return serialized;
  }

  function getModdleContext(source) {
    return new Promise((resolve, reject) => {
      const bpmnModdle = new BpmnModdle(options.moddleOptions);
      bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim(), (err, _, moddleContext) => {
        if (err) return reject(err);
        resolve(moddleContext);
      });
    });
  }

  async function waitFor(eventName) {
    return new Promise((resolve, reject) => {
      engine.once(eventName, onEvent);
      engine.once('error', onError);

      function onEvent(api) {
        engine.removeListener('error', onError);
        resolve(api);
      }
      function onError(err) {
        engine.removeListener(eventName, onError);
        reject(err);
      }
    });
  }
}

function Execution(engine, definitions, options) {
  const {environment, logger, waitFor, broker} = engine;
  broker.on('return', onBrokerReturn);

  let state = 'idle';
  let stopped;

  return {
    get state() {
      return state;
    },
    get stopped() {
      return stopped;
    },
    execute,
    getState,
    resume,
    stop,
  };

  function execute(executeOptions, callback) {
    setup(executeOptions);
    stopped = false;
    logger.debug(`<${engine.name}> execute`);

    addConsumerCallbacks(callback);
    definitions.forEach((definition) => definition.run());

    return Api();
  }

  function resume(resumeOptions, callback) {
    setup(resumeOptions);

    stopped = false;
    logger.debug(`<${engine.name}> resume`);
    addConsumerCallbacks(callback);

    definitions.forEach((definition) => definition.resume());

    return Api();
  }

  function addConsumerCallbacks(callback) {
    if (!callback) return;

    broker.off('return', onBrokerReturn);

    clearConsumers();

    broker.subscribeOnce('event', 'engine.stop', cbLeave, {consumerTag: 'ctag-cb-stop'});
    broker.subscribeOnce('event', 'engine.end', cbLeave, {consumerTag: 'ctag-cb-end'});
    broker.subscribeOnce('event', 'engine.error', cbError, {consumerTag: 'ctag-cb-error'});

    function cbLeave() {
      clearConsumers();
      return callback(null, Api());
    }
    function cbError(_, message) {
      clearConsumers();
      return callback(message.content);
    }

    function clearConsumers() {
      broker.cancel('ctag-cb-stop');
      broker.cancel('ctag-cb-end');
      broker.cancel('ctag-cb-error');
      broker.on('return', onBrokerReturn);
    }
  }

  function stop() {
    const prom = waitFor('stop');
    definitions.forEach((d) => d.stop());
    return prom;
  }

  function setup(setupOptions = {}) {
    const listener = setupOptions.listener || options.listener;
    if (listener && typeof listener.emit !== 'function') throw new Error('listener.emit is not a function');

    definitions.forEach(setupDefinition);

    function setupDefinition(definition) {
      if (listener) definition.environment.options.listener = listener;

      definition.broker.subscribeTmp('event', 'definition.#', onChildMessage, {noAck: true, consumerTag: '_engine_definition'});
      definition.broker.subscribeTmp('event', 'process.#', onChildMessage, {noAck: true, consumerTag: '_engine_process'});
      definition.broker.subscribeTmp('event', 'activity.#', onChildMessage, {noAck: true, consumerTag: '_engine_activity'});
      definition.broker.subscribeTmp('event', 'flow.#', onChildMessage, {noAck: true, consumerTag: '_engine_flow'});
    }
  }

  function onChildMessage(routingKey, message, owner) {
    const {environment: ownerEnvironment} = owner;
    const listener = ownerEnvironment.options && ownerEnvironment.options.listener;
    state = 'running';

    let executionStopped, executionCompleted, executionErrored;
    const elementApi = owner.getApi && owner.getApi(message);

    switch (routingKey) {
      case 'definition.stop':
        teardownDefinition(owner);
        if (definitions.some((d) => d.isRunning)) break;

        executionStopped = true;
        stopped = true;
        break;
      case 'definition.leave':
        teardownDefinition(owner);
        if (definitions.some((d) => d.isRunning)) break;

        executionCompleted = true;
        break;
      case 'definition.error':
        teardownDefinition(owner);
        executionErrored = true;
        break;
      case 'activity.wait': {
        emitListenerEvent('wait', owner.getApi(message), Api());
        break;
      }
      case 'process.end': {
        if (!message.content.output) break;
        for (const key in message.content.output) {
          switch (key) {
            case 'data': {
              environment.output.data = environment.output.data || {};
              environment.output.data = {...environment.output.data, ...message.content.output.data};
              break;
            }
            default: {
              environment.output[key] = message.content.output[key];
            }
          }
        }
        break;
      }
    }

    emitListenerEvent(routingKey, elementApi, Api());
    broker.publish('event', routingKey, {...message.content}, {...message.properties, mandatory: false});

    if (executionStopped) {
      state = 'stopped';
      logger.debug(`<${engine.name}> stopped`);
      onComplete('stop');
    } else if (executionCompleted) {
      state = 'idle';
      logger.debug(`<${engine.name}> completed`);
      onComplete('end');
    } else if (executionErrored) {
      state = 'error';
      logger.debug(`<${engine.name}> error`);
      onError(message.content.error);
    }

    function onComplete(eventName) {
      broker.publish('event', `engine.${eventName}`, {}, {type: eventName});
      engine.emit(eventName, Api());
    }

    function onError(err) {
      broker.publish('event', 'engine.error', err, {type: 'error', mandatory: true});
    }

    function emitListenerEvent(...args) {
      if (!listener) return;
      listener.emit(...args);
    }
  }

  function teardownDefinition(definition) {
    definition.broker.cancel('_engine_definition');
    definition.broker.cancel('_engine_process');
    definition.broker.cancel('_engine_activity');
    definition.broker.cancel('_engine_flow');
  }

  function getState() {
    return {
      name: engine.name,
      state,
      stopped,
      engineVersion,
      environment: environment.getState(),
      definitions: definitions.map(getDefinitionState),
    };
  }

  function getDefinitionState(definition) {
    return {
      ...definition.getState(),
      source: definition.environment.options.source.serialize(),
    };
  }

  function onBrokerReturn(message) {
    if (message.properties.type === 'error') {
      engine.emit('error', message.content);
    }
  }

  function Api() {
    return {
      name: engine.name,
      get state() {
        return state;
      },
      get stopped() {
        return stopped;
      },
      environment,
      definitions,
      stop,
      getState,
      getPostponed() {
        return definitions.reduce((result, definition) => {
          result = result.concat(definition.getPostponed());
          return result;
        }, []);
      },
      waitFor,
    };
  }
}
