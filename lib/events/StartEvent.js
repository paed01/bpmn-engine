'use strict';

const Activity = require('../activities/Activity');

const internals = {};

module.exports = internals.StartEvent = function(activity, parent) {
  Activity.call(this, activity, parent);
  this.isStart = true;
  this.isStartEvent = true;

  this.form = this.parentContext.getActivityForm(activity);
};

internals.StartEvent.prototype = Object.create(Activity.prototype);

internals.StartEvent.prototype.run = function() {
  this.enter();
  this.emit('start', this);

  if (this.form) {
    this.form.init();
    this.waiting = true;
    return this.emit('wait', this);
  }

  this.emit('end', this);
  this.takeAllOutbound();
};

internals.StartEvent.prototype.signal = function(input) {
  if (!this.waiting) {
    return this.emit('error', Error(`<${this.id}> is not waiting`), this);
  }

  this.waiting = false;

  this._debug(`<${this.id}>`, 'signaled', input);
  this.complete(input);
};

internals.StartEvent.prototype.complete = function(output) {
  const ioOutput = this.getOutput(output);
  this.emit('end', this, ioOutput);
  this.takeAllOutbound(ioOutput);
};

internals.StartEvent.prototype.getState = function() {
  const state = Activity.prototype.getState.call(this);
  if (this.waiting) state.waiting = this.waiting;
  if (this.form) {
    state.form = this.form.getState();
  }
  return state;
};
