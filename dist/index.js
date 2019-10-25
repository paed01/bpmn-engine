'use strict';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const BpmnModdle = require('bpmn-moddle');

const DebugLogger = require('./lib/Logger');

const elements = require('bpmn-elements');

const getOptionsAndCallback = require('./lib/getOptionsAndCallback');

const JavaScripts = require('./lib/JavaScripts');

const ProcessOutputDataObject = require('./lib/extensions/ProcessOutputDataObject');

const {
  Broker
} = require('smqp');

const {
  default: serializer,
  deserialize,
  TypeResolver
} = require('moddle-context-serializer');

const {
  EventEmitter
} = require('events');

const {
  version: engineVersion
} = require('./package.json');

module.exports = {
  Engine
};

function Engine(options = {}) {
  let execute = (() => {
    var _ref = _asyncToGenerator(function* (...args) {
      const [executeOptions, callback] = getOptionsAndCallback(...args);
      let runSources;

      try {
        runSources = yield Promise.all(pendingSources);
      } catch (err) {
        if (callback) return callback(err);
        throw err;
      }

      const definitions = runSources.map(function (source) {
        return loadDefinition(source, executeOptions);
      });
      execution = Execution(engine, definitions, options);
      return execution.execute(executeOptions, callback);
    });

    return function execute() {
      return _ref.apply(this, arguments);
    };
  })();

  let stop = (() => {
    var _ref2 = _asyncToGenerator(function* () {
      if (!execution) return;
      return execution.stop();
    });

    return function stop() {
      return _ref2.apply(this, arguments);
    };
  })();

  let resume = (() => {
    var _ref3 = _asyncToGenerator(function* (...args) {
      const [resumeOptions, callback] = getOptionsAndCallback(...args);

      if (!execution) {
        const definitions = yield getDefinitions();
        execution = Execution(engine, definitions, options);
      }

      return execution.resume(resumeOptions, callback);
    });

    return function resume() {
      return _ref3.apply(this, arguments);
    };
  })();

  let getDefinitions = (() => {
    var _ref4 = _asyncToGenerator(function* (executeOptions) {
      if (loadedDefinitions && loadedDefinitions.length) return loadedDefinitions;
      return Promise.all(pendingSources).then(function (srcs) {
        return srcs.map(function (src) {
          return loadDefinition(src, executeOptions);
        });
      });
    });

    return function getDefinitions(_x) {
      return _ref4.apply(this, arguments);
    };
  })();

  let getDefinitionById = (() => {
    var _ref5 = _asyncToGenerator(function* (id) {
      return (yield getDefinitions()).find(function (d) {
        return d.id === id;
      });
    });

    return function getDefinitionById(_x2) {
      return _ref5.apply(this, arguments);
    };
  })();

  let getState = (() => {
    var _ref6 = _asyncToGenerator(function* () {
      if (execution) return execution.getState();
      const definitions = yield getDefinitions();
      return Execution(engine, definitions, options).getState();
    });

    return function getState() {
      return _ref6.apply(this, arguments);
    };
  })();

  let serializeSource = (() => {
    var _ref7 = _asyncToGenerator(function* (source) {
      const moddleContext = yield getModdleContext(source);
      return serializeModdleContext(moddleContext);
    });

    return function serializeSource(_x3) {
      return _ref7.apply(this, arguments);
    };
  })();

  let waitFor = (() => {
    var _ref8 = _asyncToGenerator(function* (eventName) {
      return new Promise(function (resolve, reject) {
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
    });

    return function waitFor(_x4) {
      return _ref8.apply(this, arguments);
    };
  })();

  options = _objectSpread({
    Logger: DebugLogger,
    scripts: JavaScripts()
  }, options);
  let {
    name,
    Logger
  } = options;
  let loadedDefinitions, execution;
  const logger = Logger('engine');
  const sources = [];
  const typeResolver = TypeResolver(_objectSpread({}, elements, {}, options.elements || {}), defaultTypeResolver);

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
    waitFor
  });
  const broker = Broker(engine);
  broker.assertExchange('event', 'topic', {
    autoDelete: false
  });
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
    }

  });
  Object.defineProperty(engine, 'environment', {
    enumerable: true,

    get() {
      return environment;
    }

  });
  Object.defineProperty(engine, 'state', {
    enumerable: true,

    get() {
      if (execution) return execution.state;
      return 'idle';
    }

  });
  Object.defineProperty(engine, 'stopped', {
    enumerable: true,

    get() {
      if (execution) return execution.stopped;
      return false;
    }

  });
  Object.defineProperty(engine, 'execution', {
    enumerable: true,

    get() {
      return execution;
    }

  });
  return engine;

  function recover(savedState, recoverOptions) {
    if (!savedState) return engine;
    logger.debug(`<${name}> recover`);
    if (!name) name = savedState.name;
    if (recoverOptions) environment = elements.Environment(recoverOptions);
    if (savedState.environment) environment = environment.recover(savedState.environment);
    if (!savedState.definitions) return engine;
    loadedDefinitions = savedState.definitions.map(dState => {
      const source = deserialize(JSON.parse(dState.source), typeResolver);
      logger.debug(`<${name}> recover ${dState.type} <${dState.id}>`);
      const definition = loadDefinition(source);
      definition.recover(dState);
      return definition;
    });
    return engine;
  }

  function loadDefinition(serializedContext, executeOptions) {
    const context = elements.Context(serializedContext, environment.clone(_objectSpread({
      listener: environment.options.listener
    }, executeOptions, {
      source: serializedContext
    })));
    return elements.Definition(context);
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
}

function Execution(engine, definitions, options) {
  const {
    environment,
    logger,
    waitFor,
    broker
  } = engine;
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
    stop
  };

  function execute(executeOptions, callback) {
    setup(executeOptions);
    stopped = false;
    logger.debug(`<${engine.name}> execute`);
    addConsumerCallbacks(callback);
    definitions.forEach(definition => definition.run());
    return Api();
  }

  function resume(resumeOptions, callback) {
    setup(resumeOptions);
    stopped = false;
    logger.debug(`<${engine.name}> resume`);
    addConsumerCallbacks(callback);
    definitions.forEach(definition => definition.resume());
    return Api();
  }

  function addConsumerCallbacks(callback) {
    if (!callback) return;
    broker.off('return', onBrokerReturn);
    clearConsumers();
    broker.subscribeOnce('event', 'engine.stop', cbLeave, {
      consumerTag: 'ctag-cb-stop'
    });
    broker.subscribeOnce('event', 'engine.end', cbLeave, {
      consumerTag: 'ctag-cb-end'
    });
    broker.subscribeOnce('event', 'engine.error', cbError, {
      consumerTag: 'ctag-cb-error'
    });

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
    definitions.forEach(d => d.stop());
    return prom;
  }

  function setup(setupOptions = {}) {
    const listener = setupOptions.listener || options.listener;
    if (listener && typeof listener.emit !== 'function') throw new Error('listener.emit is not a function');
    definitions.forEach(setupDefinition);

    function setupDefinition(definition) {
      if (listener) definition.environment.options.listener = listener;
      definition.broker.subscribeTmp('event', 'definition.#', onChildMessage, {
        noAck: true,
        consumerTag: '_engine_definition'
      });
      definition.broker.subscribeTmp('event', 'process.#', onChildMessage, {
        noAck: true,
        consumerTag: '_engine_process'
      });
      definition.broker.subscribeTmp('event', 'activity.#', onChildMessage, {
        noAck: true,
        consumerTag: '_engine_activity'
      });
      definition.broker.subscribeTmp('event', 'flow.#', onChildMessage, {
        noAck: true,
        consumerTag: '_engine_flow'
      });
    }
  }

  function onChildMessage(routingKey, message, owner) {
    const {
      environment: ownerEnvironment
    } = owner;
    const listener = ownerEnvironment.options && ownerEnvironment.options.listener;
    state = 'running';
    let executionStopped, executionCompleted, executionErrored;
    const elementApi = owner.getApi && owner.getApi(message);

    switch (routingKey) {
      case 'definition.stop':
        teardownDefinition(owner);
        if (definitions.some(d => d.isRunning)) break;
        executionStopped = true;
        stopped = true;
        break;

      case 'definition.leave':
        teardownDefinition(owner);
        if (definitions.some(d => d.isRunning)) break;
        executionCompleted = true;
        break;

      case 'definition.error':
        teardownDefinition(owner);
        executionErrored = true;
        break;

      case 'activity.wait':
        {
          emitListenerEvent('wait', owner.getApi(message), Api());
          break;
        }

      case 'process.end':
        {
          if (!message.content.output) break;

          for (const key in message.content.output) {
            switch (key) {
              case 'data':
                {
                  environment.output.data = environment.output.data || {};
                  environment.output.data = _objectSpread({}, environment.output.data, {}, message.content.output.data);
                  break;
                }

              default:
                {
                  environment.output[key] = message.content.output[key];
                }
            }
          }

          break;
        }
    }

    emitListenerEvent(routingKey, elementApi, Api());
    broker.publish('event', routingKey, _objectSpread({}, message.content), _objectSpread({}, message.properties, {
      mandatory: false
    }));

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
      broker.publish('event', `engine.${eventName}`, {}, {
        type: eventName
      });
      engine.emit(eventName, Api());
    }

    function onError(err) {
      broker.publish('event', 'engine.error', err, {
        type: 'error',
        mandatory: true
      });
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
      definitions: definitions.map(getDefinitionState)
    };
  }

  function getDefinitionState(definition) {
    return _objectSpread({}, definition.getState(), {
      source: definition.environment.options.source.serialize()
    });
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

      waitFor
    };
  }
}