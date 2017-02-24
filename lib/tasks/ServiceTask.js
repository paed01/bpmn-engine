'use strict';

const BaseTask = require('../activities/BaseTask');
const expressions = require('../expressions');
const util = require('util');

const internals = {};

module.exports = internals.ServiceTask = function() {
  BaseTask.apply(this, arguments);
  this.service = getService.call(this, this.activity, this.parentContext);

  if (!this.service) throw new Error(`No service defined for <${this.id}>`);

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

  const input = scope.getInput(message);
  return this.service.execute(this, input, serviceCallback);
};

internals.ServiceTask.prototype.getInput = function(message) {
  if (!this.io) return this.parentContext.getVariablesAndServices(message);
  return this.io.getInput(message, true);
};

function getService(activity, parentContext) {
  if (activity.expression) {
    this._debug(`<${this.id}>`, `use expression ${activity.expression}`);
    return getServiceByExpression.call(this, activity.expression);
  }

  return parentContext.getElementService(activity);
}

function getServiceByExpression(expression) {
  return {
    name: expression,
    execute: (executeOnBehalfOf, message, callback) => {
      const serviceFn = expressions(expression, executeOnBehalfOf.parentContext.getVariablesAndServices());
      if (typeof serviceFn !== 'function') return this.emit('error', new Error(`Expression ${expression} did not resolve to a function`), this);

      serviceFn(message, function(err) {
        const args = Array.prototype.slice.call(arguments, 1);
        callback(err, args);
      });
    }
  };
}
