'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:definition');
const EventEmitter = require('events').EventEmitter;
const getPropertyValue = require('./getPropertyValue');
const mapper = require('./mapper');
const validation = require('./validation');

const internals = {};

module.exports = internals.Definition = function(moddleContext, options) {
  if (!moddleContext) throw new Error('No moddle context');
  this.moddleContext = moddleContext;
  this.id = getPropertyValue(moddleContext, 'rootHandler.element.id', 'anonymous');
  options = options || {};

  const warnings = validation.validateModdleContext(moddleContext);
  if (warnings[0]) {
    throw warnings[0];
  }
  validation.validateOptions(options);

  this.options = options;
};

internals.Definition.prototype = Object.create(EventEmitter.prototype);

internals.Definition.prototype.execute = function(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = this.options;
  } else {
    options = optionsOrCallback;
    validation.validateOptions(options);
  }

  debug(`<${this.id}>`, 'start');

  this.getProcesses(options, (err, mainProcess, allProcesses) => {
    if (err) return callback(err);

    if (!this.entryPointId) {
      return callback(new Error(`definition <${this.id}> has no executable process`));
    }

    this.started = true;
    callback(null, mainProcess, allProcesses);
    setupProcesses.call(this);
    mainProcess.run();
  });
};

internals.Definition.prototype.getProcesses = function(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
  } else {
    validation.validateOptions(optionsOrCallback);
    options = optionsOrCallback;
  }

  if (this.started) {
    if (callback) callback(null, this.mainProcess, this.processes);
    return this.processes;
  }

  loadProcesses.call(this, this.moddleContext, options || this.options);

  if (callback) callback(null, this.mainProcess, this.processes);
  return this.processes;
};

internals.Definition.prototype.getProcessById = function(processId) {
  return this.processes.find((p) => p.id === processId);
};

internals.Definition.prototype.onMessage = function(from, message, via) {
  const targetElement = contextHelper.getTargetProcess(this.moddleContext, via.targetId);

  debug(`<${this.id}>`, `message sent from <${from.id}> via <${via.id}> to <${targetElement.id}>`);

  this.getProcessById(targetElement.id).signal(via.targetId, message);
};

internals.Definition.prototype.onEnd = function(process) {
  updateVariables.call(this, process);

  if (this.processes.every((p) => p.isEnded)) {
    debug(`<${this.id}>`, 'end');
    teardownProcesses.call(this);
    this.started = false;
    this.isEnded = true;
    this.emit('end', this);
  }
};

internals.Definition.prototype.onError = function() {
  const args = Array.prototype.slice.call(arguments);
  args.unshift(this);
  args.unshift('error');
  this.emit.apply(this, args);
};

internals.Definition.prototype.getState = function() {
  const state = {
    state: getRunningStatus.call(this),
    moddleContext: contextHelper.cloneContext(this.moddleContext)
  };

  if (this.processes) {
    state.processes = this.processes.reduce((result, instance) => {
      result[instance.id] = instance.getState();
      return result;
    }, {});
  }

  return state;
};

function getRunningStatus() {
  if (!this.hasOwnProperty('started')) return 'pending';
  return this.started ? 'running' : 'completed';
}

internals.Definition.prototype.stop = function() {
  debug(`<${this.id}>`, 'stop');
  teardownProcesses.call(this);
  this.processes.forEach((p) => p.deactivate());
  this.emit('end');
};

internals.Definition.prototype.resume = function(state, optionsOrCallback, callback) {
  debug(`<${this.id}>`, 'resume');

  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else {
    options = optionsOrCallback;
  }

  this.moddleContext = state.moddleContext;

  this.getProcesses(options, (err, instance, siblings) => {
    if (err) return callback(err);
    setupProcesses.call(this);
    if (callback) callback(null, instance);
    siblings.forEach((p) => p.resume(state.processes[p.id]));
  });
};

internals.Definition.prototype.getChildActivityById = function(childId) {
  let child;
  if (!this.processes) {
    loadProcesses.call(this, this.moddleContext, this.options);
  }

  for (let i = 0; i < this.processes.length; i++) {
    child = this.processes[i].getChildActivityById(childId);
    if (child) break;
  }
  return child;
};

function loadProcesses(moddleContext, options) {
  const processElements = contextHelper.getProcesses(moddleContext);

  this.processes = processElements.map((e) => new mapper.Process(e, moddleContext, options));
  this.entryPointId = contextHelper.getExecutableProcessId(moddleContext);

  debug(`<${this.id}>`, `found ${this.processes.length} processes. Start with <${this.entryPointId}>`);
  this.mainProcess = this.processes.find((p) => p.id === this.entryPointId);
  return this.processes;
}

function setupProcesses() {
  this._onMessage = this.onMessage.bind(this);
  this._onEnd = this.onEnd.bind(this);
  this._onError = this.onError.bind(this);

  this.processes.forEach((p) => {
    p.on('message', this._onMessage);
    p.on('leave', this._onEnd);
    p.on('error', this._onError);
  });
}

function teardownProcesses() {
  this.processes.forEach((p) => {
    p.removeListener('message', this._onMessage);
    p.removeListener('leave', this._onEnd);
    p.removeListener('error', this._onError);
  });
}

function updateVariables(process) {
  this.variables = this.variables || {};
  this.variables = Object.assign(this.variables, process.context.variables);
}
