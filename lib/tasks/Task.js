'use strict';

const {EventEmitter} = require('events');
const TaskActivity = require('./task-activity');

function Task(activity) {
  Object.assign(this, activity);
}

Task.prototype = Object.create(EventEmitter.prototype);

module.exports = Task;

Task.prototype.run = function(message) {
  this.activate().run(message);
};

Task.prototype.activate = function(state) {
  const task = this;
  return TaskActivity(task, execute, state);

  function execute(activityApi, executionContext, callback) {
    callback();
  }
};
