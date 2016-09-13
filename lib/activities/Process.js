'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:activity:process');
const Activity = require('./Activity');
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Process = function(activity, parent, listener) {
  if (parent.context) {
    this.context = parent.context;
    this.listener = parent.listener;

    Activity.call(this, activity, parent);
    debug(`<${this.id}> is a sub process`);
  } else {
    this.id = activity.id;
    this.type = activity.$type;
    this.activity = activity;
    this.context = parent;
    this.listener = listener;
  }

  this.children = {};
  this.sequenceFlows = [];
  this.startActivities = [];
  this.endActivities = [];
  this.runningActivities = 0;
  this.stopInitialized = false;

  init.call(this, activity);
};

util.inherits(internals.Process, Activity);

internals.Process.prototype.run = function(variables) {
  this.entered = true;
  this.emit('enter', this);

  this.variables = Object.assign({}, variables);

  if (!this.startActivities.length) {
    return this.terminate();
  }

  activateAllChildren.call(this);

  this.startActivities.forEach((activity) => activity.run(this.variables));
};

internals.Process.prototype.cancel = function() {
  this.terminate();
};

internals.Process.prototype.terminate = function() {
  if (this.isEnded) return;
  this.isEnded = true;

  debug(`terminate <${this.id}>`, `runningActivities: ${this.runningActivities}`);

  deactivateAllChildren.call(this);
  this.emit('end', this);

  if (this.outbound) {
    this.takeAllOutbound(this.variables);
  }
};

internals.Process.prototype.stop = function(terminate) {
  if (this.isEnded) return;

  if (terminate) return this.terminate();

  debug(`<${this.id}>`, 'stop', this.runningActivities);
  if (this.runningActivities === 0) {
    this.terminate();
  }
};

internals.Process.prototype.getChildActivityById = function(activityId) {
  if (this.children[activityId]) return this.children[activityId];

  const activityDefinition = this.context.elementsById[activityId];
  const ChildActivity = mapper(activityDefinition);
  const child = new ChildActivity(activityDefinition, this);

  this.children[activityDefinition.id] = child;

  return child;
};

internals.Process.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

internals.Process.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.target.id === activityId);
};

internals.Process.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return contextHelper.isDefaultSequenceFlow(this.context, sequenceFlowId);
};

internals.Process.prototype.getSequenceFlowTarget = function(sequenceFlowId) {
  return contextHelper.getSequenceFlowTarget(this.context, sequenceFlowId);
};

internals.Process.prototype.getBoundaryEvents = function(activityId) {
  const boundaryEvents = contextHelper.getBoundaryEvents(this.context, activityId);
  return boundaryEvents.map((e) => this.getChildActivityById(e.element.id));
};

internals.Process.prototype.signal = function(activityId, input) {
  const childActivity = this.getChildActivityById(activityId);
  childActivity.signal(input);
};

function init(activity) {
  debug(`<${this.id}>`, 'init');

  if (!activity.flowElements) {
    this.startActivities = [];
    return;
  }

  initSequenceFlows.call(this);
  initActivities.call(this);

  if (!this.startActivities.length) {
    debug(`<${this.id}>`, 'is an uncontrolled flow');
  }
}

function initSequenceFlows() {
  contextHelper.getAllOutboundSequenceFlows(this.context, this.id).forEach((sf) => {
    const SequenceFlow = mapper(sf.element);
    const sequenceFlow = new SequenceFlow(sf, this);
    this.sequenceFlows.push(sequenceFlow);
  });
}

function initActivities() {
  contextHelper.getActivities(this.context, this.id).forEach((activity) => {
    if (!mapper.isSupportedType(activity.$type)) return;
    const child = this.getChildActivityById(activity.id);
    if (child.isStart) this.startActivities.push(child);
    if (child.isEnd) this.endActivities.push(child);
  });
}

function activateAllChildren() {
  Object.keys(this.children).forEach((id) => {
    const child = this.children[id];
    setupChildActivity.call(this, child);
    child.activate();
  });
}

function deactivateAllChildren() {
  Object.keys(this.children).forEach((id) => {
    const child = this.children[id];
    teardownChildActivity.call(this, child);
    child.deactivate();
  });
}

function emitActivityEvent(eventName, child) {
  if (!this.listener) return;
  this.listener.emit(`${eventName}-${child.id}`, child, this);
}

function emitProcessEvent(eventName, activity) {
  if (!this.listener) return;
  this.listener.emit(eventName, this, activity);
}

function saveOutput(child, output) {
  const dataObjects = contextHelper.getChildOutputNames(this.context, child.activity.id);
  if (dataObjects.length) {
    dataObjects.forEach((dataObject) => {
      debug(`<${this.id}>`, `setting data from <${child.id}> to variables["${dataObject.id}"]`);
      this.variables[dataObject.id] = output;
    });
  } else {
    debug(`<${this.id}>`, `setting data from <${child.id}> to variables.taskInput["${child.id}"]`);
    if (!this.variables.taskInput) this.variables.taskInput = {};
    this.variables.taskInput[child.activity.id] = output;
  }
}

function setupChildActivity(child) {
  const self = this;
  debug(`<${self.id}>`, `setup <${child.id}>`);

  child._parentStartListener = (c) => {
    emitActivityEvent.call(self, 'start', c);
  };
  child.on('start', child._parentStartListener);

  child._parentEnteredListener = (c) => {
    this.runningActivities++;

    debug(`<${this.id}>`, `entering <${child.id}>`, this.runningActivities);

    emitActivityEvent.call(self, 'enter', c);
  };
  child.on('enter', child._parentEnteredListener);

  child._parentLeaveListener = (c) => {
    this.runningActivities--;

    debug(`<${this.id}>`, `left ${c.canceled ? 'canceled' : 'completed'} <${c.id}>`, this.runningActivities);

    emitActivityEvent.call(self, 'leave', c);

    if (!c.canceled && c.isEnd) {
      if (c.terminate) return self.terminate();

      setImmediate(self.stop.bind(self, c.terminate));
    }
  };
  child.on('leave', child._parentLeaveListener);

  child._parentEndListener = (c, output) => {
    if (output) {
      saveOutput.call(this, c, output);
    }

    emitActivityEvent.call(self, 'end', c);

    if (child.isEnd) {
      if (child.terminate) return self.terminate();

      setImmediate(self.stop.bind(self, child.terminate));
    }
  };
  child.on('end', child._parentEndListener);

  child._parentCanceledListener = (c) => {
    debug(`<${this.id}>`, `canceled <${child.id}>`, this.runningActivities);

    emitActivityEvent.call(self, 'cancel', c);

    if (child.isEnd) {
      if (child.terminate) return self.terminate();

      setImmediate(self.stop.bind(self, child.terminate));
    }
  };
  child.on('cancel', child._parentCanceledListener);

  child._waitListener = function(activity) {
    emitProcessEvent.call(self, 'wait', activity);
    emitActivityEvent.call(self, 'wait', activity);
  };
  child.on('wait', child._waitListener);

  child.once('error', (e) => {
    self.emit('error', e);
  });
}

function teardownChildActivity(child) {
  debug(`<${this.id}>`, `tear down <${child.id}>`);

  // Remove listeners
  if (child._parentLeaveListener) {
    child.removeListener('leave', child._parentLeaveListener);
    delete child._parentLeaveListener;
  }

  if (child._parentStartListener) {
    child.removeListener('start', child._parentStartListener);
    delete child._parentStartListener;
  }

  if (child._parentEnteredListener) {
    child.removeListener('enter', child._parentEnteredListener);
    delete child._parentEnteredListener;
  }

  if (child._parentEndListener) {
    child.removeListener('end', child._parentEndListener);
    delete child._parentEndListener;
  }

  if (child._parentCanceledListener) {
    child.removeListener('cancel', child._parentCanceledListener);
    delete child._parentCanceledListener;
  }

  if (child._waitListener) {
    child.removeListener('wait', child._waitListener);
    delete child._waitListener;
  }
}
