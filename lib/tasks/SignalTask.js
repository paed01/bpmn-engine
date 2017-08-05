'use strict';

const {EventEmitter} = require('events');
const TaskActivity = require('./task-activity');

function SignalTask(activity) {
  Object.assign(this, activity);
}

SignalTask.prototype = Object.create(EventEmitter.prototype);

module.exports = SignalTask;

SignalTask.prototype.run = function(message) {
  this.activate().run(message);
};

SignalTask.prototype.activate = function(state) {
  const task = this;
  state = state || {};
  return TaskActivity(task, execute, state);

  function execute(activityApi, executionContext, callback) {
    const postponedExecution = executionContext.postpone((...args) => {
      delete state.waiting;
      callback(...args);
    });
    state.waiting = true;

    task.emit('wait', activityApi, postponedExecution);
  }
};
