'use strict';

const {EventEmitter} = require('events');
const TaskActivity = require('./TaskActivity');

function ServiceTask(activity) {
  Object.assign(this, activity);
  const service = activity.getService();
  this.service = service;
}

ServiceTask.prototype = Object.create(EventEmitter.prototype);

module.exports = ServiceTask;

ServiceTask.prototype.run = function(message) {
  this.activate().run(message);
};

ServiceTask.prototype.activate = function(state) {
  const task = this;
  const service = task.service;

  state = state || {};
  return TaskActivity(task, execute, state);

  function execute(activityApi, executionContext, callback) {
    if (!service) return callback(new Error(`<${task.id}> no service definition found`));
    const io = executionContext.getIo();
    const inputContext = io.getInputContext();

    const activatedService = service.activate(task, inputContext, executionContext);
    const input = io.hasIo ? io.getInput() : inputContext;

    return activatedService.execute(input, callback);
  }
};

function ServiceExecutionContext(activity, executionContext) {
  this.activity = activity;
  this.executionContext = executionContext;
}
