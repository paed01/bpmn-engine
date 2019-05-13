'use strict';

const BpmnModdle = require('./dist/bpmn-moddle');
const DebugLogger = require('./lib/Logger');
const elements = require('bpmn-elements');
const JavaScripts = require('./lib/JavaScripts');
const ProcessOutputDataObject = require('./lib/extensions/bpmn/ProcessOutputDataObject');
const {default: serializer, deserialize, TypeResolver} = require('moddle-context-serializer');
const {version: engineVersion} = require('./package.json');
const {EventEmitter} = require('events');

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

  const environment = elements.Environment(options);
  const emitter = new EventEmitter();

  const engine = Object.assign(emitter, {
    environment,
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

  Object.defineProperty(engine, 'name', {
    enumerable: true,
    get() {
      return name;
    },
    set(value) {
      name = value;
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

  async function execute(executeOptions = {}) {
    const runSources = await Promise.all(pendingSources);
    const definitions = runSources.map((source) => loadDefinition(source, executeOptions));
    execution = Execution(engine, definitions, options);
    return execution.execute(executeOptions);
  }

  async function stop() {
    if (!execution) return;
    return execution.stop();
  }

  function recover(savedState) {
    if (!name) name = savedState.name;
    if (!savedState.definitions) return engine;

    logger.debug(`<${name}> recover`);

    loadedDefinitions = savedState.definitions.map((dState) => {
      const source = deserialize(JSON.parse(dState.source), typeResolver);

      logger.debug(`<${name}> recover ${dState.type} <${dState.id}>`);

      const definition = loadDefinition(source);
      definition.recover(dState);

      return definition;
    });

    return engine;
  }

  async function resume(resumeOptions = {}) {
    if (execution) return execution.resume(resumeOptions);

    const definitions = await getDefinitions();

    execution = Execution(engine, definitions, options);

    return execution.resume(resumeOptions);
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
  const {environment, logger, waitFor} = engine;
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

  function execute(executeOptions) {
    setup(executeOptions);
    stopped = false;
    logger.debug(`<${engine.name}> execute`);

    definitions.forEach((definition) => definition.run());

    return Api();
  }

  function resume(resumeOptions) {
    setup(resumeOptions);

    stopped = false;
    logger.debug(`<${engine.name}> resume`);

    definitions.forEach((definition) => definition.resume());

    return Api();
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
      definition.broker.subscribeTmp('event', 'process.#', onChildMessage, {noAck: true, consumerTag: '_engine_process_leave'});
      definition.broker.subscribeTmp('event', 'activity.#', onChildMessage, {noAck: true, consumerTag: '_engine_activity_wait'});
    }
  }

  function onChildMessage(routingKey, message, owner) {
    const {environment: ownerEnvironment} = owner;
    const listener = ownerEnvironment.options && ownerEnvironment.options.listener;
    state = 'running';

    let executionStopped;
    switch (routingKey) {
      case 'definition.stop':
        teardownDefinition(owner);
        if (definitions.some((d) => d.isRunning)) break;
        executionStopped = true;
        state = 'idle';
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
      case 'definition.error':
        engine.emit('error', message.content.error);
        break;
      case 'definition.leave':
        state = 'idle';

        teardownDefinition(owner);
        engine.emit('end', Api());
        break;
    }

    emitListenerEvent(routingKey, owner.getApi(message), Api());
    if (executionStopped) {
      stopped = true;
      state = 'stopped';
      logger.debug(`<${engine.name}> stopped`);
      engine.emit('stop', Api());
    }

    function emitListenerEvent(...args) {
      if (!listener) return;
      listener.emit(...args);
    }
  }

  function teardownDefinition(definition) {
    definition.broker.cancel('_engine_definition');
    definition.broker.cancel('_engine_process_leave');
    definition.broker.cancel('_engine_activity_wait');
  }

  function getState() {
    return {
      name: engine.name,
      state,
      stopped,
      engineVersion,
      definitions: definitions.map(getDefinitionState),
    };
  }

  function getDefinitionState(definition) {
    return {
      ...definition.getState(),
      source: definition.environment.options.source.serialize(),
    };
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
    };
  }
}
