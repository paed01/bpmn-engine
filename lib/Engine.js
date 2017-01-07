'use strict';

const Async = require('async');
const contextHelper = require('./context-helper');
const crypto = require('crypto');
const debug = require('debug')('bpmn-engine:engine');
const EventEmitter = require('events').EventEmitter;
const Joi = require('joi');
const mapper = require('./mapper');
const transformer = require('./transformer');
const validation = require('./validation');

const internals = {};

const ctorSchema = Joi.object({
  name: Joi.string().description('name of engine'),
  source: Joi.alternatives().try(Joi.binary(), Joi.string()),
  moddleOptions: Joi.object()
});

module.exports = internals.Engine = function(options) {
  options = options || {};
  Joi.validate(options, ctorSchema);

  this.name = options.name || 'undefined';
  this.definitions = [];
  this.sources = [];
  this.moddleOptions = options.moddleOptions;

  if (options.source) {
    addSource.call(this, options.source);
  }
  this.moddleContext = options.moddleContext;
};

internals.Engine.prototype = Object.create(EventEmitter.prototype);

internals.Engine.prototype.execute = function(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    validation.validateOptions(optionsOrCallback);
    options = optionsOrCallback;
  }

  debug(`<${this.name}>`, 'start');
  this.getDefinition(options, (err, definition) => {
    if (err) return callback(err);

    setupDefinitions.call(this);

    this.started = true;
    definition.execute(callback);
  });
};

internals.Engine.prototype.getDefinition = function(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    options = optionsOrCallback;
  }

  loadDefinitions.call(this, options, (err, definitions) => {
    if (err) return callback(err);
    if (definitions.length === 0) return callback(new Error('Nothing to execute'));
    const definition = definitions[0];

    debug(`<${this.name}>`, `found ${definitions.length} definition. Start with <${definition.id}>`);

    return callback(null, definition);
  });
};

internals.Engine.prototype.addDefinitionByModdleContext = function(moddleContext, options) {
  const idx = this.definitions.findIndex((d) => d.id === contextHelper.getDefinitionId(moddleContext));
  const definition = new mapper.Definition(moddleContext, options);
  if (idx === -1) {
    this.definitions.push(definition);
  } else {
    debug(`<${this.name}>`, `definition <${definition.id}> was replaced`);
    this.definitions[idx] = definition;
  }
  return definition;
};

internals.Engine.prototype.getDefinitionById = function(definitionId) {
  return this.definitions.find((d) => d.id === definitionId);
};

internals.Engine.prototype.onMessage = function(from, message, via) {
  const targetElement = contextHelper.getTargetProcess(this.moddleContext, via.targetId);

  debug(`<${this.name}>`, `message sent from <${from.id}> via <${via.id}> to <${targetElement.id}>`);

  this.getProcess(targetElement.id).signal(via.targetId, message);
};

internals.Engine.prototype.onEnd = function() {
  if (this.definitions.every((d) => d.isEnded)) {
    debug(`<${this.name}>`, 'end');
    teardownDefinitions.call(this);
    this.started = false;
    this.emit('end', this);
  }
};

internals.Engine.prototype.getState = function() {
  const state = {
    state: this.started ? 'running' : 'idle',
  };
  if (this.moddleOptions) {
    state.moddleOptions = this.moddleOptions;
  }

  if (this.buffer) {
    state.source = this.buffer;
    state.sourceHash = sourceHash(this.buffer);
  }

  state.definitions = this.definitions.map((definition) => {
    return definition.getState();
  });

  return state;
};

internals.Engine.prototype.stop = function() {
  debug(`<${this.name}>`, 'stop');
  teardownDefinitions.call(this);
  this.definitions.forEach((d) => d.stop());
  this.emit('end');
};

internals.Engine.prototype.resume = function(state, optionsOrCallback, callback) {
  debug(`<${this.name}>`, 'resume');

  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    options = optionsOrCallback;
  }

  if (!Array.isArray(state.definitions)) {
    return callback(new Error('State definitions must be an array'));
  }

  if (state.source) {
    addSource.call(this, state.source);
    this.moddleOptions = state.moddleOptions;
  }

  if (state.context) {
    this.moddleContext = state.moddleContext;
  }

  const resumeDefinitions = state.definitions.map((d) => {
    return this.addDefinitionByModdleContext(d.moddleContext, options);
  });

  callback(null, resumeDefinitions[0], resumeDefinitions);
  setupDefinitions.call(this);

  resumeDefinitions.forEach((d, idx) => d.resume(state.definitions[idx], options));
};

function addSource(sourceXml) {
  if (Buffer.isBuffer(sourceXml)) { // Add ability to load from buffer, e.g. from http-request
    this.sources.push(sourceXml.toString());
  } else if (typeof sourceXml === 'string') {
    this.sources.push(sourceXml);
  } else {
    throw new Error('Unparsable Bpmn source');
  }
}

function loadDefinitionBySource(options, source, callback) {
  transformer.transform(source, this.moddleOptions, (err, def, moddleContext) => {
    if (err) return callback(err);
    return callback(null, this.addDefinitionByModdleContext(moddleContext, options));
  });
}

function loadDefinitions(options, callback) {
  if (this.moddleContext) {
    const definition = this.addDefinitionByModdleContext(this.moddleContext, options);
    return callback(null, [definition]);
  }

  return Async.map(this.sources, loadDefinitionBySource.bind(this, options), callback);
}

function setupDefinitions(definitions) {
  if (!this._onEnd) {
    this._onEnd = this.onEnd.bind(this);
  }

  (definitions || this.definitions).forEach((p) => {
    p.on('end', this._onEnd);
  });
}

function teardownDefinitions() {
  this.definitions.forEach((p) => {
    p.removeListener('end', this._onEnd);
  });
}

function sourceHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}
