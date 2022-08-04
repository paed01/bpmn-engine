'use strict';

const BpmnModdle = require('bpmn-moddle');
const DebugLogger = require('./lib/Logger');
const Elements = require('bpmn-elements');
const getOptionsAndCallback = require('./lib/getOptionsAndCallback');
const JavaScripts = require('./lib/JavaScripts');
const ProcessOutputDataObject = require('./lib/extensions/ProcessOutputDataObject');
const {Broker} = require('smqp');
const {default: serializer, deserialize, TypeResolver} = require('moddle-context-serializer');
const {EventEmitter} = require('events');
const {version: engineVersion} = require('./package.json');

const kEngine = Symbol.for('engine');
const kEnvironment = Symbol.for('environment');
const kExecuting = Symbol.for('executing');
const kExecution = Symbol.for('execution');
const kLoadedDefinitions = Symbol.for('loaded definitions');
const kOnBrokerReturn = Symbol.for('onBrokerReturn');
const kPendingSources = Symbol.for('pending sources');
const kSources = Symbol.for('sources');
const kState = Symbol.for('state');
const kStopped = Symbol.for('stopped');
const kTypeResolver = Symbol.for('type resolver');

module.exports = {Engine, Execution};

function Engine(options = {}) {
  if (!(this instanceof Engine)) return new Engine(options);

  EventEmitter.call(this);

  const opts = this.options = {
    Logger: DebugLogger,
    scripts: new JavaScripts(options.disableDummyScript),
    ...options,
  };

  this.logger = opts.Logger('engine');

  this[kTypeResolver] = TypeResolver({
    ...Elements,
    ...(opts.elements || {})
  }, opts.typeResolver || defaultTypeResolver);

  this[kEnvironment] = new Elements.Environment(opts);

  const broker = this.broker = new Broker(this);
  broker.assertExchange('event', 'topic', {autoDelete: false});

  this[kExecution] = null;
  this[kLoadedDefinitions] = null;
  this[kSources] = [];

  const pendingSources = this[kPendingSources] = [];
  if (opts.source) pendingSources.push(this._serializeSource(opts.source));
  if (opts.moddleContext) pendingSources.push(this._serializeModdleContext(opts.moddleContext));
  if (opts.sourceContext) pendingSources.push(opts.sourceContext);
}

function defaultTypeResolver(elementTypes) {
  elementTypes['bpmn:DataObject'] = ProcessOutputDataObject;
  elementTypes['bpmn:DataStoreReference'] = ProcessOutputDataObject;
}

Engine.prototype = Object.create(EventEmitter.prototype);

Object.defineProperty(Engine.prototype, 'name', {
  enumerable: true,
  get() {
    return this.options.name;
  },
  set(value) {
    this.options.name = value;
  },
});

Object.defineProperty(Engine.prototype, 'environment', {
  enumerable: true,
  get() {
    return this[kEnvironment];
  },
});

Object.defineProperty(Engine.prototype, 'state', {
  enumerable: true,
  get() {
    const execution = this.execution;
    if (execution) return execution.state;
    return 'idle';
  },
});

Object.defineProperty(Engine.prototype, 'stopped', {
  enumerable: true,
  get() {
    const execution = this.execution;
    if (execution) return execution.stopped;
    return false;
  },
});

Object.defineProperty(Engine.prototype, 'execution', {
  enumerable: true,
  get() {
    return this[kExecution];
  },
});

Engine.prototype.execute = async function execute(...args) {
  const [executeOptions, callback] = getOptionsAndCallback(...args);
  try {
    var definitions = await this._loadDefinitions(executeOptions); // eslint-disable-line no-var
  } catch (err) {
    if (callback) return callback(err);
    throw err;
  }

  const execution = this[kExecution] = new Execution(this, definitions, this.options);
  return execution._execute(executeOptions, callback);
};

Engine.prototype.stop = function stop() {
  const execution = this.execution;
  if (!execution) return;
  return execution.stop();
};

Engine.prototype.recover = function recover(savedState, recoverOptions) {
  if (!savedState) return this;

  let name = this.name;
  if (!name) name = this.name = savedState.name;

  this.logger.debug(`<${name}> recover`);

  if (recoverOptions) this[kEnvironment] = new Elements.Environment(recoverOptions);
  if (savedState.environment) this[kEnvironment] = this[kEnvironment].recover(savedState.environment);

  if (!savedState.definitions) return this;

  const pendingSources = this[kPendingSources];
  const preSources = pendingSources.splice(0);

  const typeResolver = this[kTypeResolver];
  const loadedDefinitions = this[kLoadedDefinitions] = savedState.definitions.map((dState) => {
    let source;
    if (dState.source) source = deserialize(JSON.parse(dState.source), typeResolver);
    else source = preSources.find((s) => s.id === dState.id);

    pendingSources.push(source);

    this.logger.debug(`<${name}> recover ${dState.type} <${dState.id}>`);

    const definition = this._loadDefinition(source);
    definition.recover(dState);

    return definition;
  });

  this[kExecution] = new Execution(this, loadedDefinitions, {}, true);

  return this;
};

Engine.prototype.resume = async function resume(...args) {
  const [resumeOptions, callback] = getOptionsAndCallback(...args);

  let execution = this.execution;
  if (!execution) {
    const definitions = await this.getDefinitions();
    if (!definitions.length) {
      const err = new Error('nothing to resume');
      if (callback) return callback(err);
      throw err;
    }
    execution = this[kExecution] = new Execution(this, definitions, this.options);
  }

  return execution._resume(resumeOptions, callback);
};

Engine.prototype.addSource = function addSource({sourceContext: addContext} = {}) {
  if (!addContext) return;
  const loadedDefinitions = this[kLoadedDefinitions];
  if (loadedDefinitions) loadedDefinitions.splice(0);
  this[kPendingSources].push(addContext);
};

Engine.prototype.getDefinitions = async function getDefinitions(executeOptions) {
  const loadedDefinitions = this[kLoadedDefinitions];
  if (loadedDefinitions?.length) return loadedDefinitions;
  return this._loadDefinitions(executeOptions);
};

Engine.prototype.getDefinitionById = async function getDefinitionById(id) {
  return (await this.getDefinitions()).find((d) => d.id === id);
};

Engine.prototype.getState = async function getState() {
  const execution = this.execution;
  if (execution) return execution.getState();

  const definitions = await this.getDefinitions();
  return new Execution(this, definitions, this.options).getState();
};

Engine.prototype.waitFor = function waitFor(eventName) {
  const self = this;
  return new Promise((resolve, reject) => {
    self.once(eventName, onEvent);
    self.once('error', onError);

    function onEvent(api) {
      self.removeListener('error', onError);
      resolve(api);
    }
    function onError(err) {
      self.removeListener(eventName, onEvent);
      reject(err);
    }
  });
};

Engine.prototype._loadDefinitions = async function loadDefinitions(executeOptions) {
  const runSources = await Promise.all(this[kPendingSources]);
  const loadedDefinitions = this[kLoadedDefinitions] = runSources.map((source) => this._loadDefinition(source, executeOptions));
  return loadedDefinitions;
};

Engine.prototype._loadDefinition = function loadDefinition(serializedContext, executeOptions = {}) {
  const {settings, variables} = executeOptions;

  const environment = this.environment;
  const context = new Elements.Context(serializedContext, environment.clone({
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

  return new Elements.Definition(context);
};

Engine.prototype._serializeSource = async function serializeSource(source) {
  const moddleContext = await this._getModdleContext(source);
  return this._serializeModdleContext(moddleContext);
};

Engine.prototype._serializeModdleContext = function serializeModdleContext(moddleContext) {
  const serialized = serializer(moddleContext, this[kTypeResolver]);
  this[kSources].push(serialized);
  return serialized;
};

Engine.prototype._getModdleContext = function getModdleContext(source) {
  const bpmnModdle = new BpmnModdle(this.options.moddleOptions);
  return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim());
};

function Execution(engine, definitions, options, isRecovered = false) {
  this.name = engine.name;
  this.options = options;
  this.definitions = definitions;
  this[kState] = 'idle';
  this[kStopped] = isRecovered;
  this[kEnvironment] = engine.environment;
  this[kEngine] = engine;
  this[kExecuting] = [];
  const onBrokerReturn = this[kOnBrokerReturn] = this._onBrokerReturn.bind(this);
  engine.broker.on('return', onBrokerReturn);
}

Object.defineProperty(Execution.prototype, 'state', {
  enumerable: true,
  get() {
    return this[kState];
  },
});

Object.defineProperty(Execution.prototype, 'stopped', {
  enumerable: true,
  get() {
    return this[kStopped];
  },
});

Object.defineProperty(Execution.prototype, 'broker', {
  enumerable: true,
  get() {
    return this[kEngine].broker;
  },
});

Object.defineProperty(Execution.prototype, 'environment', {
  enumerable: true,
  get() {
    return this[kEnvironment];
  },
});

Execution.prototype._execute = function execute(executeOptions, callback) {
  this._setup(executeOptions);
  this[kStopped] = false;
  this._debug('execute');

  this._addConsumerCallbacks(callback);
  const definitionExecutions = this.definitions.reduce((result, definition) => {
    if (!definition.getExecutableProcesses().length) return result;
    result.push(definition.run());
    return result;
  }, []);

  if (!definitionExecutions.length) {
    const error = new Error('No executable processes');
    if (!callback) return this[kEngine].emit('error', error);
    return callback(error);
  }

  return this;
};

Execution.prototype._resume = function resume(resumeOptions, callback) {
  this._setup(resumeOptions);

  this[kStopped] = false;
  this._debug('resume');
  this._addConsumerCallbacks(callback);

  this[kExecuting].splice(0);
  this.definitions.forEach((definition) => definition.resume());

  return this;
};

Execution.prototype._addConsumerCallbacks = function addConsumerCallbacks(callback) {
  if (!callback) return;

  const broker = this.broker;
  const onBrokerReturn = this[kOnBrokerReturn];

  broker.off('return', onBrokerReturn);

  clearConsumers();

  broker.subscribeOnce('event', 'engine.stop', () => {
    clearConsumers();
    return callback(null, this);
  }, {consumerTag: 'ctag-cb-stop'});

  broker.subscribeOnce('event', 'engine.end', () => {
    clearConsumers();
    return callback(null, this);
  }, {consumerTag: 'ctag-cb-end'});

  broker.subscribeOnce('event', 'engine.error', (_, message) => {
    clearConsumers();
    return callback(message.content);
  }, {consumerTag: 'ctag-cb-error'});

  return callback;

  function clearConsumers() {
    broker.cancel('ctag-cb-stop');
    broker.cancel('ctag-cb-end');
    broker.cancel('ctag-cb-error');
    broker.on('return', onBrokerReturn);
  }
};

Execution.prototype.stop = async function stop() {
  const engine = this[kEngine];
  const prom = engine.waitFor('stop');
  this[kStopped] = true;
  const timers = engine.environment.timers;

  timers.executing.slice().forEach((ref) => timers.clearTimeout(ref));

  this[kExecuting].splice(0).forEach((d) => d.stop());

  const result = await prom;
  this[kState] = 'stopped';
  return result;
};

Execution.prototype._setup = function setup(setupOptions = {}) {
  const listener = setupOptions.listener || this.options.listener;
  if (listener && typeof listener.emit !== 'function') throw new Error('listener.emit is not a function');

  const onChildMessage = this._onChildMessage.bind(this);

  for (const definition of this.definitions) {
    if (listener) definition.environment.options.listener = listener;

    definition.broker.subscribeTmp('event', 'definition.#', onChildMessage, {noAck: true, consumerTag: '_engine_definition'});
    definition.broker.subscribeTmp('event', 'process.#', onChildMessage, {noAck: true, consumerTag: '_engine_process'});
    definition.broker.subscribeTmp('event', 'activity.#', onChildMessage, {noAck: true, consumerTag: '_engine_activity'});
    definition.broker.subscribeTmp('event', 'flow.#', onChildMessage, {noAck: true, consumerTag: '_engine_flow'});
  }
};

Execution.prototype._onChildMessage = function onChildMessage(routingKey, message, owner) {
  const {environment: ownerEnvironment} = owner;
  const listener = ownerEnvironment.options?.listener;
  this[kState] = 'running';

  let newState;
  const elementApi = owner.getApi && owner.getApi(message);

  switch (routingKey) {
    case 'definition.resume':
    case 'definition.enter': {
      const executing = this[kExecuting];
      const idx = executing.indexOf(owner);
      if (idx > -1) break;
      executing.push(owner);
      break;
    }
    case 'definition.stop': {
      this._teardownDefinition(owner);

      const executing = this[kExecuting];
      if (executing.some((d) => d.isRunning)) break;

      newState = 'stopped';
      this[kStopped] = true;
      break;
    }
    case 'definition.leave':
      this._teardownDefinition(owner);

      if (this[kExecuting].some((d) => d.isRunning)) break;

      newState = 'idle';
      break;
    case 'definition.error':
      this._teardownDefinition(owner);
      newState = 'error';
      break;
    case 'activity.wait': {
      if (listener) listener.emit('wait', owner.getApi(message), this);
      break;
    }
    case 'process.end': {
      if (!message.content.output) break;
      const environment = this.environment;

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

  if (listener) listener.emit(routingKey, elementApi, this);

  const broker = this.broker;
  broker.publish('event', routingKey, {...message.content}, {...message.properties, mandatory: false});

  if (!newState) return;

  this[kState] = newState;

  switch (newState) {
    case 'stopped':
      this._debug('stopped');
      broker.publish('event', 'engine.stop', {}, {type: 'stop'});
      return this[kEngine].emit('stop', this);
    case 'idle':
      this._debug('completed');
      broker.publish('event', 'engine.end', {}, {type: 'end'});
      return this[kEngine].emit('end', this);
    case 'error':
      this._debug('error');
      return broker.publish('event', 'engine.error', message.content.error, {type: 'error', mandatory: true});
  }
};

Execution.prototype._teardownDefinition = function teardownDefinition(definition) {
  const executing = this[kExecuting];
  const idx = executing.indexOf(definition);
  if (idx > -1) executing.splice(idx, 1);

  definition.broker.cancel('_engine_definition');
  definition.broker.cancel('_engine_process');
  definition.broker.cancel('_engine_activity');
  definition.broker.cancel('_engine_flow');
};

Execution.prototype.getState = function getState() {
  const definitions = [];
  for (const definition of this.definitions) {
    definitions.push({
      ...definition.getState(),
      source: definition.environment.options.source.serialize(),
    });
  }

  return {
    name: this[kEngine].name,
    state: this.state,
    stopped: this.stopped,
    engineVersion,
    environment: this.environment.getState(),
    definitions,
  };
};

Execution.prototype.getActivityById = function getActivityById(activityId) {
  for (const definition of this.definitions) {
    const activity = definition.getActivityById(activityId);
    if (activity) return activity;
  }
};

Execution.prototype.getPostponed = function getPostponed() {
  const defs = this.stopped ? this.definitions : this[kExecuting];
  return defs.reduce((result, definition) => {
    result = result.concat(definition.getPostponed());
    return result;
  }, []);
};

Execution.prototype.signal = function signal(payload, {ignoreSameDefinition} = {}) {
  for (const definition of this[kExecuting]) {
    if (ignoreSameDefinition && payload?.parent?.id === definition.id) continue;
    definition.signal(payload);
  }
};

Execution.prototype.cancelActivity = function cancelActivity(payload) {
  for (const definition of this[kExecuting]) {
    definition.cancelActivity(payload);
  }
};

Execution.prototype.waitFor = function waitFor(...args) {
  return this[kEngine].waitFor(...args);
};

Execution.prototype._onBrokerReturn = function onBrokerReturn(message) {
  if (message.properties.type === 'error') {
    this[kEngine].emit('error', message.content);
  }
};

Execution.prototype._debug = function debug(msg) {
  this[kEngine].logger.debug(`<${this.name}> ${msg}`);
};
