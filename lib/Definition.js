'use strict';

const ContextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:definition');
const EventEmitter = require('events').EventEmitter;
const getPropertyValue = require('./getPropertyValue');
const Process = require('./activities/Process');
const validation = require('./validation');

const internals = {};

module.exports = internals.Definition = function(moddleContext, options) {
  if (!moddleContext) throw new Error('No moddle context');
  this.contextHelper = ContextHelper(moddleContext);
  this.moddleContext = moddleContext;
  this.id = getPropertyValue(moddleContext, 'rootHandler.element.id', 'anonymous');
  options = options || {};

  validation.validateOptions(options);
  this.processes = [];
  this.running = [];
  this.completed = [];

  this.options = options;
};

internals.Definition.resume = function(state, optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    options = {};
  } else if (optionsOrCallback) {
    options = {
      listener: optionsOrCallback.listener
    };
  }

  const definition = new internals.Definition(state.moddleContext, options);

  function resumeCallback(err) {
    if (err) {
      teardownProcesses.call(definition);
      if (callback) return callback.apply(null, arguments);
      return definition.emit('error', err);
    }
    if (callback) return callback.apply(null, arguments);
  }

  debug(`<${definition.id}> resume`);
  delete this.stopped;

  setTimeout(() => {
    definition.getProcesses(options, (err, instance, siblings) => {
      if (err) return resumeCallback.call(definition, err);
      setupProcesses.call(definition);

      siblings.forEach((p) => p.resume(state.processes[p.id]));

      resumeCallback.call(definition, null, instance, siblings);
    });
  }, 0);
  return definition;
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
  this.completed = [];

  this.getProcesses(options, (getErr, firstExecutableProcess, allProcesses) => {
    if (getErr) {
      if (callback) return callback(getErr);
      return this.emit('error', getErr, this);
    }

    if (!this.entryPointId) {
      const entryErr = new Error(`definition <${this.id}> has no executable process`);
      if (callback) return callback(entryErr);
      return this.emit('error', entryErr, this);
    }

    this.started = true;
    setupProcesses.call(this);
    this.emit('start', this);

    if (callback) callback(null, firstExecutableProcess, allProcesses);
    firstExecutableProcess.run();
  });
};

internals.Definition.prototype.signal = function(activityId, output) {
  let signaled;
  if (!this.processes.length) {
    loadProcesses.call(this, this.moddleContext, this.options);
  }

  for (let i = 0; i < this.processes.length; i++) {
    signaled = this.processes[i].signal(activityId, output);
    if (signaled) break;
  }

  return signaled;
};

internals.Definition.prototype.stop = function() {
  debug(`<${this.id}>`, 'stop');
  this.stopped = true;
  teardownProcesses.call(this);
  this.running.forEach((p) => p.deactivate());
  this.emit('end', this);
};

internals.Definition.prototype.getState = function() {
  const state = {
    id: this.id,
    state: getRunningStatus.call(this),
    moddleContext: this.contextHelper.clone()
  };
  if (this.stopped) {
    state.stopped = true;
  }

  state.processes = this.running.reduce((result, instance) => {
    result[instance.id] = instance.getState();
    return result;
  }, {});

  return state;
};

internals.Definition.prototype.getPendingActivities = function() {
  const pendingState = {
    id: this.id,
    state: getRunningStatus.call(this)
  };

  pendingState.children = this.processes.reduce((result, instance) => {
    result = result.concat(instance.getPendingActivities());
    return result;
  }, []);

  return pendingState;
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

  const warnings = validation.validateModdleContext(this.moddleContext);
  if (warnings.length) {
    if (callback) return callback(warnings[0]);
    return this.emit('error', warnings[0], this);
  }

  loadProcesses.call(this, this.moddleContext, options || this.options);

  if (callback) callback(null, this.mainProcess, this.processes);
  return this.processes;
};

internals.Definition.prototype.getProcessById = function(processId) {
  return this.processes.find((p) => p.id === processId);
};

internals.Definition.prototype.getChildActivityById = function(childId) {
  let child;
  if (!this.processes.length) {
    loadProcesses.call(this, this.moddleContext, this.options);
  }

  for (let i = 0; i < this.processes.length; i++) {
    child = this.processes[i].getChildActivityById(childId);
    if (child) break;
  }
  return child;
};

internals.Definition.prototype.getChildState = function(childId) {
  for (let i = 0; i < this.running.length; i++) {
    const childState = this.running[i].getChildState(childId);
    if (childState) return childState;
  }
  for (let i = 0; i < this.completed.length; i++) {
    const childState = this.completed[i].getChildState(childId);
    if (childState) return childState;
  }
};

internals.Definition.prototype.onStart = function(process, processExecution) {
  this.running.push(processExecution);
};

internals.Definition.prototype.onMessage = function(message, via) {
  const targetElement = this.contextHelper.getTargetProcess(via.targetId);

  debug(`<${this.id}> message sent from <${via.sourceId}> via <${via.id}> to <${targetElement.id}>`);

  const runningIndex = this.running.findIndex((p) => p.id === targetElement.id);

  const targetProcess = this.getProcessById(targetElement.id);
  if (runningIndex === -1) {
    debug(`<${this.id}> spinning up <${targetElement.id}>`);

    return targetProcess.run((executionContext) => {
      setImmediate(executionContext.signal, via.targetId, message);
    });
  }

  this.running[runningIndex].signal(via.targetId, message);
};

internals.Definition.prototype.onEnd = function(process, processExecution) {
  const runningIndex = this.running.findIndex((p) => p.id === process.id);
  if (runningIndex > -1) {
    this.completed.push(this.running[runningIndex]);
    this.running.splice(runningIndex, 1);
  }

  updateVariables.call(this, processExecution);

  if (!this.running.length) {
    debug(`<${this.id}>`, 'end');
    teardownProcesses.call(this);
    this.started = false;
    this.isEnded = true;
    this.emit('end', this);
  }
};

internals.Definition.prototype.onError = function(...args) {
  teardownProcesses.call(this);
  this.emit('error', ...args);
};

internals.Definition.prototype.getOutput = function() {
  return Object.assign({}, this.variables);
};

function loadProcesses(moddleContext, options) {
  const processElements = this.contextHelper.getProcesses();

  this.processes = processElements.map((e) => new Process(e, moddleContext, options));
  this.entryPointId = this.contextHelper.getExecutableProcessId();

  debug(`<${this.id}>`, `found ${this.processes.length} processes. Start with <${this.entryPointId}>`);
  this.mainProcess = this.processes.find((p) => p.id === this.entryPointId);
  return this.processes;
}

function setupProcesses() {
  this._onStart = this.onStart.bind(this);
  this._onMessage = this.onMessage.bind(this);
  this._onEnd = this.onEnd.bind(this);
  this._onError = this.onError.bind(this);

  this.processes.forEach((p) => {
    p.on('start', this._onStart);
    p.on('message', this._onMessage);
    p.on('end', this._onEnd);
    p.on('error', this._onError);
  });
}

function teardownProcesses() {
  this.processes.forEach((p) => {
    p.removeListener('start', this._onStart);
    p.removeListener('message', this._onMessage);
    p.removeListener('end', this._onEnd);
    p.removeListener('error', this._onError);
  });
}

function updateVariables(processExecution) {
  const output = processExecution.getOutput();
  this.variables = this.variables || {};
  this.variables = Object.assign(this.variables, output.variables);
}

function getRunningStatus() {
  if (!this.hasOwnProperty('started')) return 'pending';
  return this.started ? 'running' : 'completed';
}

