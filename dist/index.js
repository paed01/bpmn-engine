'use strict';

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

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

var _require = require('smqp'),
    Broker = _require.Broker;

var _require2 = require('moddle-context-serializer'),
    serializer = _require2["default"],
    deserialize = _require2.deserialize,
    TypeResolver = _require2.TypeResolver;

var _require3 = require('events'),
    EventEmitter = _require3.EventEmitter;

var _require4 = require('./package.json'),
    engineVersion = _require4.version;

module.exports = {
  Engine: Engine
};

function Engine() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  options = _objectSpread({
    Logger: DebugLogger,
    scripts: JavaScripts()
  }, options);
  var _options = options,
      name = _options.name,
      Logger = _options.Logger;
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
    execute: execute,
    logger: logger,
    getDefinitionById: getDefinitionById,
    getDefinitions: getDefinitions,
    getState: getState,
    recover: recover,
    resume: resume,
    stop: stop,
    waitFor: waitFor
  });
  var broker = Broker(engine);
  broker.assertExchange('event', 'topic', {
    autoDelete: false
  });
  Object.defineProperty(engine, 'broker', {
    enumerable: true,
    get: function get() {
      return broker;
    }
  });
  Object.defineProperty(engine, 'name', {
    enumerable: true,
    get: function get() {
      return name;
    },
    set: function set(value) {
      name = value;
    }
  });
  Object.defineProperty(engine, 'environment', {
    enumerable: true,
    get: function get() {
      return environment;
    }
  });
  Object.defineProperty(engine, 'state', {
    enumerable: true,
    get: function get() {
      if (execution) return execution.state;
      return 'idle';
    }
  });
  Object.defineProperty(engine, 'stopped', {
    enumerable: true,
    get: function get() {
      if (execution) return execution.stopped;
      return false;
    }
  });
  Object.defineProperty(engine, 'execution', {
    enumerable: true,
    get: function get() {
      return execution;
    }
  });
  return engine;

  function execute() {
    return _execute.apply(this, arguments);
  }

  function _execute() {
    _execute = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee() {
      var _getOptionsAndCallbac,
          _getOptionsAndCallbac2,
          executeOptions,
          callback,
          runSources,
          definitions,
          _args = arguments;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _getOptionsAndCallbac = getOptionsAndCallback.apply(void 0, _args), _getOptionsAndCallbac2 = _slicedToArray(_getOptionsAndCallbac, 2), executeOptions = _getOptionsAndCallbac2[0], callback = _getOptionsAndCallbac2[1];
              _context.prev = 1;
              _context.next = 4;
              return Promise.all(pendingSources);

            case 4:
              runSources = _context.sent;
              _context.next = 12;
              break;

            case 7:
              _context.prev = 7;
              _context.t0 = _context["catch"](1);

              if (!callback) {
                _context.next = 11;
                break;
              }

              return _context.abrupt("return", callback(_context.t0));

            case 11:
              throw _context.t0;

            case 12:
              definitions = runSources.map(function (source) {
                return loadDefinition(source, executeOptions);
              });
              execution = Execution(engine, definitions, options);
              return _context.abrupt("return", execution.execute(executeOptions, callback));

            case 15:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, null, [[1, 7]]);
    }));
    return _execute.apply(this, arguments);
  }

  function stop() {
    return _stop.apply(this, arguments);
  }

  function _stop() {
    _stop = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee2() {
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              if (execution) {
                _context2.next = 2;
                break;
              }

              return _context2.abrupt("return");

            case 2:
              return _context2.abrupt("return", execution.stop());

            case 3:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2);
    }));
    return _stop.apply(this, arguments);
  }

  function recover(savedState, recoverOptions) {
    if (!savedState) return engine;
    logger.debug("<".concat(name, "> recover"));
    if (!name) name = savedState.name;
    if (recoverOptions) environment = elements.Environment(recoverOptions);
    if (savedState.environment) environment = environment.recover(savedState.environment);
    if (!savedState.definitions) return engine;
    loadedDefinitions = savedState.definitions.map(function (dState) {
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
    _resume = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee3() {
      var _getOptionsAndCallbac3,
          _getOptionsAndCallbac4,
          resumeOptions,
          callback,
          definitions,
          _args3 = arguments;

      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _getOptionsAndCallbac3 = getOptionsAndCallback.apply(void 0, _args3), _getOptionsAndCallbac4 = _slicedToArray(_getOptionsAndCallbac3, 2), resumeOptions = _getOptionsAndCallbac4[0], callback = _getOptionsAndCallbac4[1];

              if (execution) {
                _context3.next = 6;
                break;
              }

              _context3.next = 4;
              return getDefinitions();

            case 4:
              definitions = _context3.sent;
              execution = Execution(engine, definitions, options);

            case 6:
              return _context3.abrupt("return", execution.resume(resumeOptions, callback));

            case 7:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3);
    }));
    return _resume.apply(this, arguments);
  }

  function getDefinitions(_x) {
    return _getDefinitions.apply(this, arguments);
  }

  function _getDefinitions() {
    _getDefinitions = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee4(executeOptions) {
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              if (!(loadedDefinitions && loadedDefinitions.length)) {
                _context4.next = 2;
                break;
              }

              return _context4.abrupt("return", loadedDefinitions);

            case 2:
              return _context4.abrupt("return", Promise.all(pendingSources).then(function (srcs) {
                return srcs.map(function (src) {
                  return loadDefinition(src, executeOptions);
                });
              }));

            case 3:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4);
    }));
    return _getDefinitions.apply(this, arguments);
  }

  function getDefinitionById(_x2) {
    return _getDefinitionById.apply(this, arguments);
  }

  function _getDefinitionById() {
    _getDefinitionById = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee5(id) {
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return getDefinitions();

            case 2:
              _context5.t0 = function (d) {
                return d.id === id;
              };

              return _context5.abrupt("return", _context5.sent.find(_context5.t0));

            case 4:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5);
    }));
    return _getDefinitionById.apply(this, arguments);
  }

  function getState() {
    return _getState.apply(this, arguments);
  }

  function _getState() {
    _getState = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee6() {
      var definitions;
      return regeneratorRuntime.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              if (!execution) {
                _context6.next = 2;
                break;
              }

              return _context6.abrupt("return", execution.getState());

            case 2:
              _context6.next = 4;
              return getDefinitions();

            case 4:
              definitions = _context6.sent;
              return _context6.abrupt("return", Execution(engine, definitions, options).getState());

            case 6:
            case "end":
              return _context6.stop();
          }
        }
      }, _callee6);
    }));
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
    _serializeSource = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee7(source) {
      var moddleContext;
      return regeneratorRuntime.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              _context7.next = 2;
              return getModdleContext(source);

            case 2:
              moddleContext = _context7.sent;
              return _context7.abrupt("return", serializeModdleContext(moddleContext));

            case 4:
            case "end":
              return _context7.stop();
          }
        }
      }, _callee7);
    }));
    return _serializeSource.apply(this, arguments);
  }

  function serializeModdleContext(moddleContext) {
    var serialized = serializer(moddleContext, typeResolver);
    sources.push(serialized);
    return serialized;
  }

  function getModdleContext(source) {
    return new Promise(function (resolve, reject) {
      var bpmnModdle = new BpmnModdle(options.moddleOptions);
      bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim(), function (err, _, moddleContext) {
        if (err) return reject(err);
        resolve(moddleContext);
      });
    });
  }

  function waitFor(_x4) {
    return _waitFor.apply(this, arguments);
  }

  function _waitFor() {
    _waitFor = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee8(eventName) {
      return regeneratorRuntime.wrap(function _callee8$(_context8) {
        while (1) {
          switch (_context8.prev = _context8.next) {
            case 0:
              return _context8.abrupt("return", new Promise(function (resolve, reject) {
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
              }));

            case 1:
            case "end":
              return _context8.stop();
          }
        }
      }, _callee8);
    }));
    return _waitFor.apply(this, arguments);
  }
}

function Execution(engine, definitions, options) {
  var environment = engine.environment,
      logger = engine.logger,
      waitFor = engine.waitFor,
      broker = engine.broker;
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

    execute: execute,
    getState: getState,
    resume: resume,
    stop: stop
  };

  function execute(executeOptions, callback) {
    setup(executeOptions);
    stopped = false;
    logger.debug("<".concat(engine.name, "> execute"));
    addConsumerCallbacks(callback);
    definitions.forEach(function (definition) {
      return definition.run();
    });
    return Api();
  }

  function resume(resumeOptions, callback) {
    setup(resumeOptions);
    stopped = false;
    logger.debug("<".concat(engine.name, "> resume"));
    addConsumerCallbacks(callback);
    definitions.forEach(function (definition) {
      return definition.resume();
    });
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
    definitions.forEach(function (d) {
      return d.stop();
    });
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
    var ownerEnvironment = owner.environment;
    var listener = ownerEnvironment.options && ownerEnvironment.options.listener;
    state = 'running';
    var executionStopped, executionCompleted, executionErrored;
    var elementApi = owner.getApi && owner.getApi(message);

    switch (routingKey) {
      case 'definition.stop':
        teardownDefinition(owner);
        if (definitions.some(function (d) {
          return d.isRunning;
        })) break;
        executionStopped = true;
        stopped = true;
        break;

      case 'definition.leave':
        teardownDefinition(owner);
        if (definitions.some(function (d) {
          return d.isRunning;
        })) break;
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
      listener.emit.apply(listener, arguments);
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
      state: state,
      stopped: stopped,
      engineVersion: engineVersion,
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

      environment: environment,
      definitions: definitions,
      stop: stop,
      getState: getState,
      getPostponed: function getPostponed() {
        return definitions.reduce(function (result, definition) {
          result = result.concat(definition.getPostponed());
          return result;
        }, []);
      },
      waitFor: waitFor
    };
  }
}