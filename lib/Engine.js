'use strict';

const Async = require('async');
const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:engine');
const EventEmitter = require('events').EventEmitter;
const mapper = require('./mapper');
const transformer = require('./transformer');
const validation = require('./validation');

const internals = {};
const validOptions = ['name', 'source', 'moddleContext', 'moddleOptions'];

module.exports = internals.Engine = function(options) {
  options = options || {};

  Object.keys(options).forEach((key) => {
    if (validOptions.indexOf(key) === -1) throw new Error(`Option ${key} is unsupported`);
  });

  this.name = options.name || 'undefined';
  this.definitions = [];
  this.sources = [];
  this.moddleContexts = [];
  this.moddleOptions = options.moddleOptions;

  if (options.source) {
    addSource.call(this, options.source);
  }
  if (options.moddleContext) {
    addModdleContext.call(this, options.moddleContext);
  }

  this._onEnd = this.onEnd.bind(this);
  this._onError = this.onError.bind(this);
};

internals.Engine.prototype = Object.create(EventEmitter.prototype);

internals.Engine.resume = function(engineState, executeOptionsOrCallback, callback) {
  if (!Array.isArray(engineState.definitions)) {
    throw new Error('State definitions must be an array');
  }

  let options;
  if (typeof executeOptionsOrCallback === 'function') {
    callback = executeOptionsOrCallback;
    options = {};
  } else {
    options = executeOptionsOrCallback;
  }

  function resumeCallback(err) {
    if (err) {
      teardownDefinitions.call(engine);
      if (callback) return callback.apply(null, arguments);
      return this.emit('error', err);
    }
    if (callback) return callback.apply(null, arguments);
  }

  const engine = new internals.Engine({
    name: engineState.name
  });
  debug(`<${engine.name}>`, 'resume');

  function resume() {
    Async.each(engineState.definitions, (definitionState, next) => {
      const definition = mapper.Definition.resume(definitionState, options, next);
      engine.definitions.push(definition);
      setupDefinition.call(engine, definition);
    }, (err) => {
      if (err) return resumeCallback.call(engine, err);
      resumeCallback.call(engine, null, engine.definitions[0], engine.definitions);
    });
  }

  process.nextTick(resume);

  return engine;
};

internals.Engine.prototype.execute = function(executeOptionsOrCallback, callback) {
  let executeOptions = {};
  if (typeof executeOptionsOrCallback === 'function') {
    callback = executeOptionsOrCallback;
    executeOptions = {};
  } else {
    validation.validateOptions(executeOptionsOrCallback);
    executeOptions = executeOptionsOrCallback;
  }

  function executeCallback(err) {
    if (callback) return callback.apply(null, arguments);
    if (err) this.emit('error', err);
  }

  this.getDefinitions((getErr, definitions) => {
    if (getErr) return executeCallback.call(this, getErr);
    if (!definitions.length) return executeCallback.call(this, new Error('Nothing to execute'));

    debug(`<${this.name}>`, `start all definitions (${definitions.length})`);

    setupDefinitions.call(this, definitions);

    this.started = true;
    Async.each(definitions, (d, next) => {
      d.execute(executeOptions, next);
    }, (err) => {
      executeCallback.call(this, err, definitions[0], definitions);
    });
  });
};

internals.Engine.prototype.getDefinitions = function(callback) {
  if (this.definitions.length) return callback(null, this.definitions);
  return loadDefinitions.call(this, callback);
};

internals.Engine.prototype.getDefinition = function(callback) {
  this.getDefinitions((err, definitions) => {
    if (err) return callback(err);
    if (definitions.length === 0) return callback();
    const definition = definitions[0];
    return callback(null, definition);
  });
};

internals.Engine.prototype.addDefinitionBySource = function(source, moddleOptionsOrCallback, callback) {
  let moddleOptions;
  if (typeof moddleOptionsOrCallback === 'function') {
    callback = moddleOptionsOrCallback;
    moddleOptions = this.moddleOptions;
  } else {
    moddleOptions = moddleOptionsOrCallback;
  }

  getModdleContext(source, moddleOptions, (err, moddleContext) => {
    if (err) return callback(err);
    return callback(null, this.addDefinitionByModdleContext(moddleContext));
  });
};

internals.Engine.prototype.addDefinitionByModdleContext = function(moddleContext) {
  const idx = this.definitions.findIndex((d) => d.id === contextHelper.getDefinitionId(moddleContext));
  const definition = new mapper.Definition(moddleContext);
  if (idx === -1) {
    debug(`<${this.name}>`, `add definition <${definition.id}>`);
    this.definitions.push(definition);
  } else {
    debug(`<${this.name}>`, `definition <${definition.id}> is replaced`);
    this.definitions[idx] = definition;
  }
  return definition;
};

internals.Engine.prototype.getDefinitionById = function(definitionId) {
  return this.definitions.find((d) => d.id === definitionId);
};

internals.Engine.prototype.onEnd = function(lastReportingDefinition) {
  if (this.definitions.every((d) => d.isEnded || d.stopped)) {
    debug(`<${this.name}>`, 'end');
    teardownDefinitions.call(this);
    this.started = false;
    this.emit('end', lastReportingDefinition);
  }
};

internals.Engine.prototype.onError = function() {
  const args = Array.prototype.slice.call(arguments);

  teardownDefinitions.call(this);
  this.started = false;

  args.unshift('error');
  this.emit.apply(this, args);
};

internals.Engine.prototype.getState = function() {
  const state = {
    name: this.name,
    state: this.started ? 'running' : 'idle',
  };

  state.definitions = this.definitions.map((definition) => {
    return definition.getState();
  });
  return state;
};

internals.Engine.prototype.getPendingActivities = function() {
  const pendingState = {
    name: this.name,
    state: this.started ? 'running' : 'idle',
  };

  pendingState.definitions = this.definitions.map((definition) => {
    return definition.getPendingActivities();
  });
  return pendingState;
};

internals.Engine.prototype.signal = function(activityId, output) {
  if (!this.started) return;

  for (const defIdx in this.definitions) {
    const definition = this.definitions[defIdx];
    const child = definition.getChildActivityById(activityId);
    if (child && child.waiting) {
      return definition.signal(activityId, output);
    }
  }
};

internals.Engine.prototype.stop = function() {
  debug(`<${this.name}>`, 'stop');
  this.definitions.forEach((d) => d.stop());
};

function addSource(sourceXml) {
  if (Buffer.isBuffer(sourceXml)) {
    this.sources.push(sourceXml.toString());
  } else if (typeof sourceXml === 'string') {
    this.sources.push(sourceXml);
  } else {
    this.emit('error', new Error('Unparsable Bpmn source'));
  }
}

function addModdleContext(moddleContext) {
  this.moddleContexts.push(moddleContext);
}

function loadDefinitionBySource(source, callback) {
  debug(`<${this.name}>`, 'load definition from source');
  getModdleContext(source, this.moddleOptions, (err, moddleContext) => {
    if (err) return callback(err);
    return callback(null, this.addDefinitionByModdleContext(moddleContext));
  });
}

function loadDefinitions(callback) {
  if (this.sources.length) {
    return Async.map(this.sources, loadDefinitionBySource.bind(this), callback);
  }
  if (this.moddleContexts.length) {
    return callback(null, this.moddleContexts.map(this.addDefinitionByModdleContext.bind(this)));
  }
  return callback(null, []);
}

function setupDefinition(definition) {
  definition.on('end', this._onEnd);
  definition.on('error', this._onError);
}

function setupDefinitions(definitions) {
  definitions.forEach(setupDefinition.bind(this));
}

function teardownDefinitions() {
  this.definitions.forEach((p) => {
    p.removeListener('end', this._onEnd);
    p.removeListener('error', this._onError);
  });
}

function getModdleContext(source, moddleOptions, callback) {
  transformer.transform(source, moddleOptions, (err, def, moddleContext) => {
    return callback(err, moddleContext);
  });
}
