'use strict';

const Async = require('async');
const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:engine');
const EventEmitter = require('events').EventEmitter;
const mapper = require('./mapper');
const transformer = require('./transformer');
const utils = require('util');
const validation = require('./validation');

const internals = {};

module.exports = internals.Engine = function(sourceXml) {
  if (Buffer.isBuffer(sourceXml)) { // Add ability to load from buffer, e.g. from http-request
    this.source = sourceXml.toString();
  } else if (typeof sourceXml === 'string') {
    this.source = sourceXml;
  } else {
    throw new Error('Unparsable Bpmn source');
  }
};

utils.inherits(internals.Engine, EventEmitter);

internals.Engine.prototype.startInstance = function(variables, listener, callback) {
  debug('start');
  this.getInstance(variables, listener, (err, mainProcess, allProcesses) => {
    if (err) return callback(err);
    callback(null, mainProcess, allProcesses);

    setupProcesses.call(this);

    mainProcess.run();
  });
};

internals.Engine.prototype.getInstance = function(variables, listener, callback) {
  Async.waterfall([
    transformer.transform.bind(null, this.source),
    (definition, moddleContext, next) => {
      this.definition = definition;
      this.moddleContext = moddleContext;
      next(null, definition, moddleContext);
    },
    validation.validate.bind(null),
    (next) => {
      loadProcesses.call(this, this.moddleContext, variables, listener);
      if (!this.entryPointId) {
        return next(new Error('definition has no executable process'));
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
    this.emit('end', this);
  }
};

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
    p.on('end', this._onEnd);
  });
}

function teardownProcesses() {
  this.processes.forEach((p) => {
    p.removeListener('message', this._onMessage);
    p.removeListener('end', this._onEnd);
  });
}
