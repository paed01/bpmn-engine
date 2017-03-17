'use strict';

const BaseTask = require('../activities/BaseTask');

function UserTask() {
  BaseTask.apply(this, arguments);
  this._debug(`<${this.id}> ${this.uuid}`, 'init');
  this.form = this.parentContext.getActivityForm(this.activity);
}

UserTask.prototype = Object.create(BaseTask.prototype);

UserTask.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, 'execute');
  if (this.form) {
    this.form.init(this.getInput(message));
  }

  this.emit('start', this);
  this.waiting = true;
  this.emit('wait', this);
};

UserTask.prototype.signal = function(input) {
  if (!this.waiting) {
    return this.emit('error', new Error(`<${this.id}> is not waiting`), this);
  }

  this.waiting = false;

  this.dataOutput = input;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled', input);
  this.complete(input);
};

UserTask.prototype.cancel = function() {
  this._debug(`<${this.id}>`, 'cancel');
  BaseTask.prototype.cancel.apply(this, arguments);
};

UserTask.prototype.getState = function() {
  const state = BaseTask.prototype.getState.call(this);
  if (this.waiting) state.waiting = this.waiting;
  if (this.form) {
    state.form = this.form.getState();
  }
  return state;
};

module.exports = UserTask;
