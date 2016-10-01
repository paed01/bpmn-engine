'use strict';

const Context = require('../Context');
const debug = require('debug')('bpmn-engine:process');
const BaseTask = require('./BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.Process = function(activity, moddleOrParentContext, listener, variables) {
  this.context = getContext(activity, moddleOrParentContext, listener, variables);
  this.listener = this.context.listener;

  debug(`<${activity.id}>`, 'init', listener ? 'with listener' : 'without listener');

  BaseTask.call(this, activity, (isSubprocess(moddleOrParentContext) ? moddleOrParentContext : this.context));
};

function isSubprocess(context) {
  return context instanceof Context;
}

function getContext(activity, moddleOrParentContext, listener, variables) {
  if (isSubprocess(moddleOrParentContext)) {
    debug(`<${activity.id}>`, 'is most likelly a subProcess');
    return new Context(activity.id, moddleOrParentContext.moddleContext, moddleOrParentContext.listener, moddleOrParentContext.variables);
  }

  debug(`<${activity.id}>`, 'is most likelly a main process');
  return new Context(activity.id, moddleOrParentContext, listener, variables);
}

util.inherits(internals.Process, BaseTask);

// internals.Process.prototype.run = function() {
//   BaseTask.prototype.run.apply(this, arguments);

//   this._debug(`<${this.id}>`, 'execute');
//   this.isEnded = false;

//   this.runningActivities = [];
//   activateAllChildren.call(this);

//   this.emit('start', this);

//   if (this.context.childCount === 0) {
//     return this.complete();
//   }

//   this.context.startActivities.forEach((activity) => activity.run());
// };

internals.Process.prototype.execute = function() {
  this._debug(`<${this.id}>`, 'execute');
  this.isEnded = false;

  this.runningActivities = [];
  activateAllChildren.call(this);

  this.emit('start', this);

  if (this.context.childCount === 0) {
    return this.complete();
  }

  this.context.startActivities.forEach((activity) => activity.run());
};

internals.Process.prototype.complete = function() {
  this._debug(`<${this.id}>`, 'complete');
  deactivateAllChildren.call(this);

  this.variables = this.context.variables;
  this.isEnded = true;

  BaseTask.prototype.complete.apply(this, arguments);
};

internals.Process.prototype.cancel = function() {
  deactivateAllChildren.call(this);
  BaseTask.prototype.cancel.apply(this, arguments);
};

internals.Process.prototype.signal = function(childId, input) {
  this._debug(`<${this.id}>`, `signal <${childId}>`);
  const child = this.getChildActivityById(childId);
  if (child.isStartEvent) {
    this.context.applyMessage(input);
    return this.run();
  }

  child.signal(input);
};

internals.Process.prototype.getChildActivityById = function(childId) {
  return this.context.getChildActivityById(childId);
};

internals.Process.prototype.onChildEnter = function(activity) {
  this._debug(`<${this.id}>`, `enter <${activity.id}> (${activity.type})`);
  this.runningActivities.push(activity);
  emitListenerEvent.call(this, 'enter', activity);
};

internals.Process.prototype.onChildStart = function(activity) {
  emitListenerEvent.call(this, 'start', activity);
};

internals.Process.prototype.onChildCancel = function(activity) {
  emitListenerEvent.call(this, 'cancel', activity);
};

internals.Process.prototype.onChildWait = function(activity) {
  this._debug(`<${this.id}>`, `wait for <${activity.id}> (${activity.type})`);
  emitListenerEvent.call(this, 'wait', activity);
};

internals.Process.prototype.onChildEnd = function(activity, output) {
  this._debug(`<${this.id}>`, `end <${activity.id}> (${activity.type})`);
  if (output) {
    this.context.saveChildOutput(activity.id, output);
  }

  emitListenerEvent.call(this, 'end', activity, output);

  if (activity.terminate) {
    this.complete();
  }
};

internals.Process.prototype.onChildLeave = function(activity) {
  this._debug(`<${this.id}>`, `left <${activity.id}> (${activity.type})`);
  this.runningActivities = this.runningActivities.filter((c) => c.id !== activity.id);
  emitListenerEvent.call(this, 'leave', activity);
};

internals.Process.prototype.onChildError = function(err) {
  this.emit('error', err);
};

internals.Process.prototype.onMessage = function(message, via) {
  this._debug(`<${this.id}>`, `message sent via <${via.id}> (${via.type})`);
  this.emit('message', this, message, via);
};

function activateAllChildren() {
  const self = this;

  self._onChildEnter = self.onChildEnter.bind(this);
  self._onChildStart = self.onChildStart.bind(this);
  self._onChildWait = self.onChildWait.bind(this);
  self._onChildEnd = self.onChildEnd.bind(this);
  self._onChildCancel = self.onChildCancel.bind(this);
  self._onChildLeave = self.onChildLeave.bind(this);
  self._onChildError = self.onChildError.bind(this);

  Object.keys(self.context.children).forEach((id) => {
    const activity = self.context.children[id];
    setupChildActivity.call(this, activity);
    activity.activate();
  });

  self._onEndActivityLeave = function(activity) {
    this._debug(`<${self.id}>`, `reached end with ${activity.canceled ? 'canceled' : 'completed'} <${activity.id}>`);
    this._debug(`<${self.id}>`, `# of active ${self.runningActivities.length}`);

    if (self.runningActivities.filter(a => !a.canceled).length === 0) {
      self.complete();
    }
  };

  self.context.endActivities.forEach((activity) => {
    activity.on('leave', this._onEndActivityLeave);
  });

  self.context.messageFlows.forEach((flow) => {
    setupFlowActivity.call(this, flow);
  });
}

function deactivateAllChildren() {
  Object.keys(this.context.children).forEach((id) => {
    const child = this.context.children[id];
    teardownChildActivity.call(this, child);
    child.deactivate();
  });

  this.context.messageFlows.forEach((flow) => {
    teardownChildActivity.call(this, flow);
  });

  this.context.endActivities.forEach((activity) => {
    activity.removeListener('leave', this._onEndActivityLeave);
  });

  this.context.messageFlows.forEach((flow) => {
    teardownFlowActivity.call(this, flow);
  });
}

function setupChildActivity(activity) {
  const self = this;
  this._debug(`<${self.id}>`, `setup <${activity.id}>`);

  activity.on('enter', this._onChildEnter);
  activity.on('start', this._onChildStart);
  activity.on('wait', this._onChildWait);
  activity.on('cancel', this._onChildCancel);
  activity.on('end', this._onChildEnd);
  activity.on('leave', this._onChildLeave);

  if (!this.context.hasAttachedErrorEvent(activity.id)) {
    activity.on('error', this._onChildError);
  }
}

function teardownChildActivity(activity) {
  this._debug(`<${this.id}>`, `tear down <${activity.id}>`);

  activity.removeListener('enter', this._onChildEnter);
  activity.removeListener('start', this._onChildStart);
  activity.removeListener('wait', this._onChildWait);
  activity.removeListener('cancel', this._onChildCancel);
  activity.removeListener('end', this._onChildEnd);
  activity.removeListener('leave', this._onChildLeave);
  activity.removeListener('error', this._onChildError);
}

function setupFlowActivity(flow) {
  this._onMessage = this.onMessage.bind(this);
  flow.on('message', this._onMessage);
}

function teardownFlowActivity(flow) {
  this._debug(`<${this.id}>`, `tear down flow <${flow.id}>`);
  flow.removeListener('message', this._onMessage);
}

function emitListenerEvent(eventName, activity, parent) {
  if (!this.listener) return;
  if (!parent) parent = this;

  this.listener.emit(`${eventName}-${activity.id}`, activity, parent);
  this.listener.emit(eventName, activity, parent);
}
