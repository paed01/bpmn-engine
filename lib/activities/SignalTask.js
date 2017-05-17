'use strict';

const BaseTask = require('./BaseTask');

function SignalTask() {
  BaseTask.apply(this, arguments);
}

SignalTask.prototype = Object.create(BaseTask.prototype);

SignalTask.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}>`, 'execute');

  this.emit('start', executionContext.getActivityApi({
    waiting: true
  }));
  this.waiting = true;

  this.emit('wait', executionContext.postpone(callback));
};

SignalTask.prototype.signal = function() {
};

SignalTask.prototype.getState = function() {
  const state = BaseTask.prototype.getState.call(this);
  if (this.waiting) state.waiting = this.waiting;
  return state;
};

module.exports = SignalTask;
