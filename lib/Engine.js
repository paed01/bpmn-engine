'use strict';

const Async = require('async');
const contextHelper = require('./context-helper');
const crypto = require('crypto');
const debug = require('debug')('bpmn-engine:engine');
const EventEmitter = require('events').EventEmitter;
const mapper = require('./mapper');
const transformer = require('./transformer');
const utils = require('util');
const validation = require('./validation');

const internals = {};

module.exports = internals.Engine = function(sourceXml) {
  setSource.call(this, sourceXml);
};

utils.inherits(internals.Engine, EventEmitter);

internals.Engine.prototype.startInstance = function(variables, listener, callback) {
  debug('start');
  this.getInstance(variables, listener, (err, mainProcess, allProcesses) => {
    if (err) return callback(err);
    this.started = true;
    callback(null, mainProcess, allProcesses);
    setupProcesses.call(this);
    mainProcess.run();
  });
};

internals.Engine.prototype.getInstance = function(variables, listener, callback) {
  Async.waterfall([
    transformer.transform.bind(null, this.source),
    (definition, moddleContext, next) => {
      this.id = definition.id || 'anonymous';
      this.definition = definition;
      this.moddleContext = moddleContext;
      next(null, definition, moddleContext);
    },
    validation.validate.bind(null),
    (next) => {
      loadProcesses.call(this, this.moddleContext, variables, listener);
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

  debug(`message sent from <${from.id}> via <${via.id}> to <${targetElement.id}>`);

  this.getProcess(targetElement.id).signal(via.targetId, message);
};

internals.Engine.prototype.onEnd = function() {
  if (this.processes.every((p) => p.isEnded)) {
    teardownProcesses.call(this);
    this.started = false;
    this.emit('end', this);
  }
};

internals.Engine.prototype.save = function() {
  const state = {
    state: this.started ? 'started' : 'completed',
    source: this.buffer,
    sourceHash: sourceHash(this.buffer)
  };

  state.processes = this.processes.reduce((result, instance) => {
    result[instance.id] = instance.getState();
    return result;
  }, {});

  return state;
};

internals.Engine.prototype.stop = function() {
  this.processes.forEach((p) => p.deactivate());
};

internals.Engine.prototype.resume = function(state, listener, callback) {
  debug('resume');
  setSource.call(this, state.source);
  this.getInstance(state.variables, listener, (err, instance) => {
    if (err) return callback(err);
    instance.resume(state.processes[instance.id]);
    callback(null, this.initProcess);
  });
};

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

function loadProcesses(moddleContext, variables, listener) {
  this.processElements = contextHelper.getProcesses(moddleContext);
  this.entryPointId = contextHelper.getExecutableProcessId(moddleContext);

  debug(`found ${this.processElements.length} processes. Start with <${this.entryPointId}>`);

  this.processes = this.processElements.map((e) => new mapper.Process(e, moddleContext, listener, variables));
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
