'use strict';

const Async = require('async');
const contextHelper = require('./context-helper');
const crypto = require('crypto');
const debug = require('debug')('bpmn-engine:engine');
const EventEmitter = require('events').EventEmitter;
const getPropertyValue = require('./getPropertyValue');
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

const serviceModuleSchema = Joi.object({
  module: Joi.string().required().description('module name'),
  type: Joi.string().valid('global', 'require').description('module type'),
  fnName: Joi.string().description('function name')
});

const executeSchema = Joi.object({
  listener: Joi.object({
    emit: Joi.func().required()
  }).unknown(),
  variables: Joi.object().unknown(),
  services: Joi.object().pattern(/.*/, Joi.alternatives(serviceModuleSchema, Joi.func()))
});

module.exports = internals.Engine = function(options) {
  options = options || {};
  Joi.validate(options, ctorSchema);

  this.name = options.name || 'undefined';
  if (options.source) {
    setSource.call(this, options.source);
  }
  this.moddleContext = options.context;
  this.moddleOptions = options.moddleOptions;
};

internals.Engine.prototype = Object.create(EventEmitter.prototype);

internals.Engine.prototype.execute = function(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    options = optionsOrCallback;
  }

  Joi.validate(options, executeSchema, (validationErr) => {
    if (validationErr) return callback(validationErr);

    debug(`<${this.name}>`, 'start');
    this.getInstance(options, (err, mainProcess, allProcesses) => {
      if (err) return callback(err);
      this.started = true;
      callback(null, mainProcess, allProcesses);
      setupProcesses.call(this);
      mainProcess.run();
    });
  });
};

internals.Engine.prototype.getInstance = function(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    options = optionsOrCallback;
  }

  Async.waterfall([
    getContext.call(this, options),
    (definition, moddleContext, next) => {
      this.id = getPropertyValue(moddleContext, 'rootHandler.element.id', 'anonymous');
      this.definition = definition;
      this.moddleContext = moddleContext;
      next(null, moddleContext);
    },
    validation.validate.bind(null),
    (next) => {
      loadProcesses.call(this, this.moddleContext, options);
      if (!this.entryPointId) {
        return next(new Error(`definition <${this.id}> has no executable process`));
      }
      return next(null, this.initProcess, this.processes);
    }
  ], callback);
};

internals.Engine.prototype.getProcess = function(processId) {
  return this.processes.find((p) => p.id === processId);
};

internals.Engine.prototype.onMessage = function(from, message, via) {
  const targetElement = contextHelper.getTargetProcess(this.moddleContext, via.targetId);

  debug(`<${this.name}>`, `message sent from <${from.id}> via <${via.id}> to <${targetElement.id}>`);

  this.getProcess(targetElement.id).signal(via.targetId, message);
};

internals.Engine.prototype.onEnd = function() {
  if (this.processes.every((p) => p.isEnded)) {
    debug(`<${this.name}>`, 'end');
    teardownProcesses.call(this);
    this.started = false;
    this.emit('end', this);
  }
};

internals.Engine.prototype.getState = function() {
  const state = {
    state: this.started ? 'started' : 'completed',
    moddleOptions: this.moddleOptions,
    context: contextHelper.cloneContext(this.moddleContext)
  };

  if (this.buffer) {
    state.source = this.buffer;
    state.sourceHash = sourceHash(this.buffer);
  }

  state.processes = this.processes.reduce((result, instance) => {
    result[instance.id] = instance.getState();
    return result;
  }, {});

  return state;
};

internals.Engine.prototype.stop = function() {
  debug(`<${this.name}>`, 'stop');
  teardownProcesses.call(this);
  this.processes.forEach((p) => p.deactivate());
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

  setSource.call(this, state.source);
  this.moddleOptions = state.moddleOptions;
  this.getInstance(options, (err, instance, siblings) => {
    if (err) return callback(err);
    setupProcesses.call(this);
    callback(null, instance);
    siblings.forEach((p) => p.resume(state.processes[p.id]));
  });
};

function getContext() {
  if (this.source) return transformer.transform.bind(null, this.source, this.moddleOptions);
  return (next) => {
    if (!this.moddleContext) return next(new Error('context is required if no source'));
    next(null, null, this.moddleContext);
  };
}

function setSource(sourceXml) {
  if (Buffer.isBuffer(sourceXml)) { // Add ability to load from buffer, e.g. from http-request
    this.buffer = sourceXml;
    this.source = sourceXml.toString();
  } else if (typeof sourceXml === 'string') {
    this.buffer = new Buffer(sourceXml);
    this.source = sourceXml;
  } else {
    throw new Error('Unparsable Bpmn source');
  }
}

function loadProcesses(moddleContext, options) {
  this.processElements = contextHelper.getProcesses(moddleContext);
  this.entryPointId = contextHelper.getExecutableProcessId(moddleContext);

  debug(`<${this.name}>`, `found ${this.processElements.length} processes. Start with <${this.entryPointId}>`);

  this.processes = this.processElements.map((e) => new mapper.Process(e, moddleContext, options));
  this.initProcess = this.processes.find((p) => p.id === this.entryPointId);
}

function setupProcesses() {
  this._onMessage = this.onMessage.bind(this);
  this._onEnd = this.onEnd.bind(this);

  this.processes.forEach((p) => {
    p.on('message', this._onMessage);
    p.on('leave', this._onEnd);
  });
}

function teardownProcesses() {
  this.processes.forEach((p) => {
    p.removeListener('message', this._onMessage);
    p.removeListener('leave', this._onEnd);
  });
}

function sourceHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}
