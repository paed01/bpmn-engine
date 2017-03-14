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

  validation.validateOptions(options);
  this.processes = [];

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
  const activity = this.getChildActivityById(activityId);
  if (!activity) {
    debug(`<${this.id}>`, `signal failed! Activity <${activityId}> was not found`);
    return false;
  }
  debug(`<${this.id}>`, `signal ${activity.type} <${activityId}>`);
  activity.signal(output);
  return true;
};

internals.Definition.prototype.stop = function() {
  debug(`<${this.id}>`, 'stop');
  this.stopped = true;
  teardownProcesses.call(this);
  this.processes.forEach((p) => p.deactivate());
  this.emit('end', this);
};

internals.Definition.prototype.getState = function() {
  const state = {
    id: this.id,
    state: getRunningStatus.call(this),
    moddleContext: contextHelper.cloneContext(this.moddleContext)
  };
  if (this.stopped) {
    state.stopped = true;
  }

  state.processes = this.processes.reduce((result, instance) => {
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
  teardownProcesses.call(this);

  args.unshift('error');
  args.push(this);
  this.emit.apply(this, args);
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

function getRunningStatus() {
  if (!this.hasOwnProperty('started')) return 'pending';
  return this.started ? 'running' : 'completed';
}

