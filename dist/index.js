'use strict';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var BpmnModdle = require('bpmn-moddle');

var DebugLogger = require('./lib/Logger');

var elements = require('bpmn-elements');

var getOptionsAndCallback = require('./lib/getOptionsAndCallback');

var JavaScripts = require('./lib/JavaScripts');

var ProcessOutputDataObject = require('./lib/extensions/ProcessOutputDataObject');

var {
  Broker
} = require('smqp');

var {
  default: serializer,
  deserialize,
  TypeResolver
} = require('moddle-context-serializer');

var {
  EventEmitter
} = require('events');

var {
  version: engineVersion
} = require('./package.json');

module.exports = {
  Engine
};

function Engine() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  options = _objectSpread({
    Logger: DebugLogger,
    scripts: JavaScripts()
  }, options);
  var {
    name,
    Logger
  } = options;
  var loadedDefinitions, execution;
  var logger = Logger('engine');
  var sources = [];
  var typeResolver = TypeResolver(_objectSpread({}, elements, {}, options.elements || {}), defaultTypeResolver);

  function defaultTypeResolver(elementTypes) {
    if (options.typeResolver) return options.typeResolver(elementTypes);
    elementTypes['bpmn:DataObject'] = ProcessOutputDataObject;
  }

  var pendingSources = [];
  if (options.source) pendingSources.push(serializeSource(options.source));
  if (options.moddleContext) pendingSources.push(serializeModdleContext(options.moddleContext));
  var environment = elements.Environment(options);
  var emitter = new EventEmitter();
  var engine = Object.assign(emitter, {
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
  var broker = Broker(engine);
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

  function execute() {
    return _execute.apply(this, arguments);
  }

  function _execute() {
    _execute = _asyncToGenerator(function* () {
      var [executeOptions, callback] = getOptionsAndCallback(...arguments);
      var runSources;

      try {
        runSources = yield Promise.all(pendingSources);
      } catch (err) {
        if (callback) return callback(err);
        throw err;
      }

      var definitions = runSources.map(source => loadDefinition(source, executeOptions));
      execution = Execution(engine, definitions, options);
      return execution.execute(executeOptions, callback);
    });
    return _execute.apply(this, arguments);
  }

  function stop() {
    return _stop.apply(this, arguments);
  }

  function _stop() {
    _stop = _asyncToGenerator(function* () {
      if (!execution) return;
      return execution.stop();
    });
    return _stop.apply(this, arguments);
  }

  function recover(savedState, recoverOptions) {
    if (!savedState) return engine;
    logger.debug("<".concat(name, "> recover"));
    if (!name) name = savedState.name;
    if (recoverOptions) environment = elements.Environment(recoverOptions);
    if (savedState.environment) environment = environment.recover(savedState.environment);
    if (!savedState.definitions) return engine;
    loadedDefinitions = savedState.definitions.map(dState => {
      var source = deserialize(JSON.parse(dState.source), typeResolver);
      logger.debug("<".concat(name, "> recover ").concat(dState.type, " <").concat(dState.id, ">"));
      var definition = loadDefinition(source);
      definition.recover(dState);
      return definition;
    });
    return engine;
  }

  function resume() {
    return _resume.apply(this, arguments);
  }

  function _resume() {
    _resume = _asyncToGenerator(function* () {
      var [resumeOptions, callback] = getOptionsAndCallback(...arguments);

      if (!execution) {
        var definitions = yield getDefinitions();
        execution = Execution(engine, definitions, options);
      }

      return execution.resume(resumeOptions, callback);
    });
    return _resume.apply(this, arguments);
  }

  function getDefinitions(_x) {
    return _getDefinitions.apply(this, arguments);
  }

  function _getDefinitions() {
    _getDefinitions = _asyncToGenerator(function* (executeOptions) {
      if (loadedDefinitions && loadedDefinitions.length) return loadedDefinitions;
      return Promise.all(pendingSources).then(srcs => srcs.map(src => loadDefinition(src, executeOptions)));
    });
    return _getDefinitions.apply(this, arguments);
  }

  function getDefinitionById(_x2) {
    return _getDefinitionById.apply(this, arguments);
  }

  function _getDefinitionById() {
    _getDefinitionById = _asyncToGenerator(function* (id) {
      return (yield getDefinitions()).find(d => d.id === id);
    });
    return _getDefinitionById.apply(this, arguments);
  }

  function getState() {
    return _getState.apply(this, arguments);
  }

  function _getState() {
    _getState = _asyncToGenerator(function* () {
      if (execution) return execution.getState();
      var definitions = yield getDefinitions();
      return Execution(engine, definitions, options).getState();
    });
    return _getState.apply(this, arguments);
  }

  function loadDefinition(serializedContext, executeOptions) {
    var context = elements.Context(serializedContext, environment.clone(_objectSpread({
      listener: environment.options.listener
    }, executeOptions, {
      source: serializedContext
    })));
    return elements.Definition(context);
  }

  function serializeSource(_x3) {
    return _serializeSource.apply(this, arguments);
  }

  function _serializeSource() {
    _serializeSource = _asyncToGenerator(function* (source) {
      var moddleContext = yield getModdleContext(source);
      return serializeModdleContext(moddleContext);
    });
    return _serializeSource.apply(this, arguments);
  }

  function serializeModdleContext(moddleContext) {
    var serialized = serializer(moddleContext, typeResolver);
    sources.push(serialized);
    return serialized;
  }

  function getModdleContext(source) {
    return new Promise((resolve, reject) => {
      var bpmnModdle = new BpmnModdle(options.moddleOptions);
      bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim(), (err, _, moddleContext) => {
        if (err) return reject(err);
        resolve(moddleContext);
      });
    });
  }

  function waitFor(_x4) {
    return _waitFor.apply(this, arguments);
  }

  function _waitFor() {
    _waitFor = _asyncToGenerator(function* (eventName) {
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
    });
    return _waitFor.apply(this, arguments);
  }
}

function Execution(engine, definitions, options) {
  var {
    environment,
    logger,
    waitFor,
    broker
  } = engine;
  broker.on('return', onBrokerReturn);
  var state = 'idle';
  var stopped;
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
    logger.debug("<".concat(engine.name, "> execute"));
    addConsumerCallbacks(callback);
    definitions.forEach(definition => definition.run());
    return Api();
  }

  function resume(resumeOptions, callback) {
    setup(resumeOptions);
    stopped = false;
    logger.debug("<".concat(engine.name, "> resume"));
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
    var prom = waitFor('stop');
    definitions.forEach(d => d.stop());
    return prom;
  }

  function setup() {
    var setupOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var listener = setupOptions.listener || options.listener;
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
    var {
      environment: ownerEnvironment
    } = owner;
    var listener = ownerEnvironment.options && ownerEnvironment.options.listener;
    state = 'running';
    var executionStopped, executionCompleted, executionErrored;
    var elementApi = owner.getApi && owner.getApi(message);

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

          for (var key in message.content.output) {
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
      logger.debug("<".concat(engine.name, "> stopped"));
      onComplete('stop');
    } else if (executionCompleted) {
      state = 'idle';
      logger.debug("<".concat(engine.name, "> completed"));
      onComplete('end');
    } else if (executionErrored) {
      state = 'error';
      logger.debug("<".concat(engine.name, "> error"));
      onError(message.content.error);
    }

    function onComplete(eventName) {
      broker.publish('event', "engine.".concat(eventName), {}, {
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

    function emitListenerEvent() {
      if (!listener) return;
      listener.emit(...arguments);
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