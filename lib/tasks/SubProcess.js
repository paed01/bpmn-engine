'use strict';

const Context = require('../Context');
const debug = require('debug')('bpmn-engine:task:subProcess');
const Task = require('./Task');
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  debug(`<${activity.id}>`, 'init');

  this.context = new Context(activity.id, parent.context);
  this.listener = parent.listener;

  Task.call(this, activity, this.context);
};

util.inherits(internals.Task, Task);

internals.Task.prototype.run = function(variables) {
  Task.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this._variables = variables;

  this.runningActivities = [];
  activateAllChildren.call(this);

  this.emit('start', this);
  this.context.startActivities.forEach((activity) => activity.run(this.variables));
};

internals.Task.prototype.complete = function() {
  debug(`<${this.id}>`, 'complete');
  deactivateAllChildren.call(this);
  Task.prototype.complete.apply(this, arguments);
};

internals.Task.prototype.cancel = function() {
  debug(`<${this.id}>`, 'cancel');
  Task.prototype.cancel.apply(this, arguments);
};

internals.Task.prototype.onChildEnter = function(activity) {
  debug(`<${this.id}>`, `enter <${activity.id}>`);
  this.runningActivities.push(activity);
  emitListenerEvent.call(this, 'enter', activity);
};

internals.Task.prototype.onChildLeave = function(activity) {
  debug(`<${this.id}>`, `left <${activity.id}>`);
  this.runningActivities = this.runningActivities.filter((c) => c.id !== activity.id);
  emitListenerEvent.call(this, 'leave', activity);
};

internals.Task.prototype.onChildWait = function(activity) {
  debug(`<${this.id}>`, `wait for <${activity.id}>`);
  emitListenerEvent.call(this, 'wait', activity);
};

function activateAllChildren() {
  const self = this;

  self._onChildEnter = self.onChildEnter.bind(this);
  self._onChildLeave = self.onChildLeave.bind(this);
  self._onChildWait = self.onChildWait.bind(this);

  Object.keys(self.context.children).forEach((id) => {
    const activity = self.context.children[id];
    setupChildActivity.call(this, activity);
    activity.activate();
  });

  self._onEndActivityLeave = function(activity) {
    debug(`<${self.id}>`, `reached end with ${activity.canceled ? 'canceled' : 'completed'} <${activity.id}>`);
    debug(`<${self.id}>`, `# of active ${self.runningActivities.length}`);
    if (self.runningActivities.length === 0) {
      self.complete();
    }
  };

  self.context.endActivities.forEach((activity) => {
    activity.on('leave', this._onEndActivityLeave);
  });
}

function deactivateAllChildren() {
  Object.keys(this.context.children).forEach((id) => {
    const child = this.context.children[id];
    teardownChildActivity.call(this, child);
    child.deactivate();
  });

  this.context.endActivities.forEach((activity) => {
    activity.removeListener('leave', this._onEndActivityLeave);
  });
}

function setupChildActivity(activity) {
  const self = this;
  debug(`<${self.id}>`, `setup <${activity.id}>`);

  activity.on('enter', this._onChildEnter);
  activity.on('leave', this._onChildLeave);
  activity.on('wait', this._onChildWait);
}

function teardownChildActivity(activity) {
  debug(`<${this.id}>`, `tear down <${activity.id}>`);

  activity.removeListener('enter', this._onChildEnter);
  activity.removeListener('leave', this._onChildLeave);
  activity.removeListener('wait', this._onChildWait);
}

function emitListenerEvent(eventName, activity) {
  if (!this.listener) return;
  this.listener.emit(`${eventName}-${activity.id}`, activity, this);
  this.listener.emit(eventName, this, activity);
}
