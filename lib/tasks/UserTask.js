'use strict';

const {EventEmitter} = require('events');
const TaskActivity = require('./task-activity');

function UserTask(activity) {
  Object.assign(this, activity);
  this.isStart = !this.inbound || this.inbound.length === 0;
}

UserTask.prototype = Object.create(EventEmitter.prototype);

module.exports = UserTask;

UserTask.prototype.run = function(message) {
  this.activate().run(message);
};

UserTask.prototype.activate = function(state) {
  const task = this;
  state = state || {};
  const taskActivity = TaskActivity(task, execute, state);
  return taskActivity;

  function execute(activityApi, executionContext, callback) {
    const postponedExecution = executionContext.postpone((...args) => {
      delete state.waiting;
      callback(...args);
    });
    state.waiting = true;

    task.emit('wait', activityApi, postponedExecution);
  }
};
