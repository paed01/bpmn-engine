'use strict';

const BaseTask = require('../activities/BaseTask');
const expressions = require('../expressions');
const util = require('util');

const internals = {};

module.exports = internals.ServiceTask = function() {
  BaseTask.apply(this, arguments);
  this.service = getService.call(this, this.activity, this.parentContext);
  this.resultVariable = this.activity.resultVariable;
};

util.inherits(internals.ServiceTask, BaseTask);

internals.ServiceTask.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, `execute ${this.service.name}`);
  this.taken = true;
  this.emit('start', this);

  const scope = this;

  function serviceCallback(err, serviceResult) {
    if (err) return scope.emit('error', err, scope);
    if (scope.resultVariable) {
      const result = {};
      result[scope.resultVariable] = serviceResult;
      return scope.complete(result);
    }

    return scope.complete(serviceResult);
  }

  const input = scope.io.getInput(message, true);
  return this.service.execute(this, input, serviceCallback);
};

function getService(activity, parentContext) {
  if (activity.expression) {
    this._debug(`<${this.id}>`, `use expression ${activity.expression}`);
    return getServiceByExpression(activity.expression);
  }

  return parentContext.getElementService(activity);
}

function getServiceByExpression(expression) {
  return {
    name: expression,
    execute: (message, executionContext, callback) => {
      const serviceFn = expressions(expression, executionContext);
      serviceFn(executionContext, function(err) {
        const args = Array.prototype.slice.call(arguments, 1);
        callback(err, args);
      });
    }
  };
}
