'use strict';

const Task = require('../tasks/Task');
const Parameter = require('../parameter');

function ServiceTask(activity) {
  Task.apply(this, arguments);
  const service = activity.getServiceDefinition();
  this.service = service;

  setServiceResultVariableIO(this, service);
}

ServiceTask.prototype = Object.create(Task.prototype);

module.exports = ServiceTask;

ServiceTask.prototype.execute = function(executionContext, callback) {
  const service = this.getServiceDefinition();
  if (!service) return callback(new Error(`<${this.id}> no service definition found`));

  return this.service.execute(this, executionContext.getInput(), callback);
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
