'use strict';

const BaseTask = require('../activities/BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.UserTask = function() {
  BaseTask.apply(this, arguments);
  this._debug(`<${this.id}> ${this.uuid}`, 'init');
  this.form = this.parentContext.getActivityForm(this.activity);
};

util.inherits(internals.UserTask, BaseTask);

internals.UserTask.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, 'execute');
  if (this.form) {
    this.form.init(this.getInput(message));
  }

  this.emit('start', this);
  this.waiting = true;
  this.emit('wait', this);
};

internals.UserTask.prototype.signal = function(input) {
  if (!this.waiting) {
    throw new Error(`<${this.id}> is not waiting`);
  }

  this.waiting = false;

  this.dataOutput = input;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled', input);
  this.complete(input);
};

internals.UserTask.prototype.cancel = function() {
  this._debug(`<${this.id}>`, 'cancel');
  BaseTask.prototype.cancel.apply(this, arguments);
};

internals.UserTask.prototype.getState = function() {
  const state = BaseTask.prototype.getState.call(this);
  if (this.waiting) state.waiting = this.waiting;
  if (this.form) {
    state.form = this.form.getState();
  }
  return state;
};
