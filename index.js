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
  options = {Logger: DebugLogger, scripts: JavaScripts(options.disableDummyScript), ...options};

  let {name, Logger, sourceContext} = options;

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
  if (sourceContext) pendingSources.push(sourceContext);

  let environment = elements.Environment(options);
  const emitter = new EventEmitter();

  const engine = Object.assign(emitter, {
    logger,
    addSource,
    execute,
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
    try {
      var definitions = await loadDefinitions(executeOptions); // eslint-disable-line no-var
    } catch (err) {
      if (callback) return callback(err);
      throw err;
    }

    execution = Execution(engine, definitions, options);
    return execution.execute(executeOptions, callback);
  }

  function stop() {
    if (!execution) return;
    return execution.stop();
  }

  function recover(savedState, recoverOptions) {
    if (!savedState) return engine;
    if (!name) name = savedState.name;

    logger.debug(`<${name}> recover`);

    if (recoverOptions) environment = elements.Environment(recoverOptions);
    if (savedState.environment) environment = environment.recover(savedState.environment);

    if (!savedState.definitions) return engine;

    const preSources = pendingSources.splice(0);

    loadedDefinitions = savedState.definitions.map((dState) => {
      let source;
      if (dState.source) source = deserialize(JSON.parse(dState.source), typeResolver);
      else source = preSources.find((s) => s.id === dState.id);

      pendingSources.push(source);

      logger.debug(`<${name}> recover ${dState.type} <${dState.id}>`);

      const definition = loadDefinition(source);
      definition.recover(dState);

      return definition;
    });

    execution = Execution(engine, loadedDefinitions, {}, true);

    return engine;
  }

  async function resume(...args) {
    const [resumeOptions, callback] = getOptionsAndCallback(...args);

    if (!execution) {
      const definitions = await getDefinitions();
      if (!definitions.length) {
        const err = new Error('nothing to resume');
        if (callback) return callback(err);
        throw err;
      }
      execution = Execution(engine, definitions, options);
    }

    return execution.resume(resumeOptions, callback);
  }

  function addSource({sourceContext: addContext} = {}) {
    if (!addContext) return;
    if (loadedDefinitions) loadedDefinitions.splice(0);
    pendingSources.push(addContext);
  }

  async function getDefinitions(executeOptions) {
    if (loadedDefinitions && loadedDefinitions.length) return loadedDefinitions;
    return loadDefinitions(executeOptions);
  }

  async function getDefinitionById(id) {
    return (await getDefinitions()).find((d) => d.id === id);
  }

  async function getState() {
    if (execution) return execution.getState();

    const definitions = await getDefinitions();
    return Execution(engine, definitions, options).getState();
  }

  async function loadDefinitions(executeOptions) {
    const runSources = await Promise.all(pendingSources);
    loadedDefinitions = runSources.map((source) => loadDefinition(source, executeOptions));
    return loadedDefinitions;
  }

  function loadDefinition(serializedContext, executeOptions = {}) {
    const {settings, variables} = executeOptions;

    const context = elements.Context(serializedContext, environment.clone({
      listener: environment.options.listener,
      ...executeOptions,
      settings: {
        ...environment.settings,
        ...settings,
      },
      variables: {
        ...environment.variables,
        ...variables,
      },
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
    const bpmnModdle = new BpmnModdle(options.moddleOptions);
    return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim());
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
        engine.removeListener(eventName, onEvent);
        reject(err);
      }
    });
  }
}

function Execution(engine, definitions, options, isRecovered = false) {
  const {environment, logger, waitFor, broker} = engine;
  broker.on('return', onBrokerReturn);

  let state = 'idle';
  let stopped = isRecovered;
  const executing = [];

  return {
    ...Api(),
    get state() {
      return state;
    },
    get stopped() {
      return stopped;
    },
    execute,
    resume,
  };

  function execute(executeOptions, callback) {
    setup(executeOptions);
    stopped = false;
    logger.debug(`<${engine.name}> execute`);

    addConsumerCallbacks(callback);
    const definitionExecutions = definitions.reduce((result, definition) => {
      if (!definition.getExecutableProcesses().length) return result;
      result.push(definition.run());
      return result;
    }, []);

    if (!definitionExecutions.length) {
      const error = new Error('No executable processes');
      if (!callback) return engine.emit('error', error);
      return callback(error);
    }

    return Api();
  }

  function resume(resumeOptions, callback) {
    setup(resumeOptions);

    stopped = false;
    logger.debug(`<${engine.name}> resume`);
    addConsumerCallbacks(callback);

    executing.splice(0);
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

    return callback;

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

  async function stop() {
    const prom = waitFor('stop');
    stopped = true;
    const timers = environment.timers;
    timers.executing.slice().forEach((ref) => timers.clearTimeout(ref));
    executing.splice(0).forEach((d) => d.stop());
    const result = await prom;
    state = 'stopped';
    return result;
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
      case 'definition.resume':
      case 'definition.enter': {
        const idx = executing.indexOf(owner);
        if (idx > -1) break;
        executing.push(owner);
        break;
      }
      case 'definition.stop':
        teardownDefinition(owner);
        if (executing.some((d) => d.isRunning)) break;

        executionStopped = true;
        stopped = true;
        break;
      case 'definition.leave':
        teardownDefinition(owner);

        if (executing.some((d) => d.isRunning)) break;

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
    const idx = executing.indexOf(definition);
    if (idx > -1) executing.splice(idx, 1);

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

  function getActivityById(activityId) {
    for (const definition of definitions) {
      const activity = definition.getActivityById(activityId);
      if (activity) return activity;
    }
  }

  function getPostponed() {
    const defs = stopped ? definitions : executing;
    return defs.reduce((result, definition) => {
      result = result.concat(definition.getPostponed());
      return result;
    }, []);
  }

  function signal(payload, {ignoreSameDefinition} = {}) {
    for (const definition of executing) {
      if (ignoreSameDefinition && payload && payload.parent && payload.parent.id === definition.id) continue;
      definition.signal(payload);
    }
  }

  function cancelActivity(payload) {
    for (const definition of executing) {
      definition.cancelActivity(payload);
    }
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
      broker,
      environment,
      definitions,
      getActivityById,
      getState,
      getPostponed,
      signal,
      cancelActivity,
      stop,
      waitFor,
    };
  }
}
