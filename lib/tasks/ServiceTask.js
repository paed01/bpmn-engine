'use strict';

const {EventEmitter} = require('events');
const Parameter = require('../parameter');
const TaskActivity = require('./task-activity');

function ServiceTask(activity) {
  Object.assign(this, activity);
  const service = activity.getServiceDefinition();
  this.service = service;
  this.isStart = !this.inbound || this.inbound.length === 0;

  setServiceResultVariableIO(this, service);
}

ServiceTask.prototype = Object.create(EventEmitter.prototype);

module.exports = ServiceTask;

ServiceTask.prototype.run = function(message) {
  this.activate().run(message);
};

ServiceTask.prototype.activate = function(state) {
  const task = this;
  const service = this.getServiceDefinition();

  state = state || {};
  return TaskActivity(task, execute, state);

  function execute(activityApi, executionContext, callback) {
    if (!service) return callback(new Error(`<${task.id}> no service definition found`));
    return service.execute(this, executionContext.getInput(), callback);
  }
};

function setServiceResultVariableIO(scope, service) {
  if (!service || !service.resultVariable) return;
  scope.io = scope.io || {};
  if (scope.io.output) return;

  scope.io.output = [Parameter({
    name: service.resultVariable,
    value: '${result}'
  })];
}
