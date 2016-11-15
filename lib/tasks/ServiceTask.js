'use strict';

const BaseTask = require('../activities/BaseTask');
const expressions = require('../expressions');
const util = require('util');

const internals = {};

module.exports = internals.ServiceTask = function() {
  BaseTask.apply(this, arguments);
  this.service = getService.call(this, this.activity, this.parentContext);
  this.resultVariable = this.activity.resultVariable || 'result';
};

util.inherits(internals.ServiceTask, BaseTask);

internals.ServiceTask.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, `execute ${this.serviceName}`);
  this.taken = true;
  this.emit('start', this);

  const scope = this;

  function serviceCallback(err) {
    if (err) return scope.emit('error', err, scope);

    const result = {};
    result[scope.resultVariable] = Array.prototype.slice.call(arguments, 1);

    scope.complete(result);
  }

  const executionContext = Object.assign({}, this.parentContext.getVariablesAndServices({
    activityId: this.id
  }), message);

  this.service.execute(message, executionContext, serviceCallback);
};

function getService(activity, parentContext) {
  if (activity.expression) {
    this._debug(`<${this.id}>`, `use expression ${activity.expression}`);
    return getServiceByExpression(activity.expression);
  }
  const serviceName = parentContext.getElementServiceName(activity);
  this._debug(`<${this.id}>`, `use service name ${serviceName}`);
  return getServiceByName(serviceName, parentContext);
}

function getServiceByName(serviceName, parentContext) {
  return {
    execute: (message, executionContext, callback) => {
      const serviceFn = parentContext.getServiceByName(serviceName);

      if (message && Array.isArray(message.arguments)) {
        const args = message.arguments.concat([callback]);
        return serviceFn.apply(null, args);
      }

      return serviceFn(executionContext, callback);
    }
  };
}

function getServiceByExpression(expression) {
  return {
    execute: (message, executionContext, callback) => {
      const serviceFn = expressions(expression, executionContext);
      serviceFn(executionContext, callback);
    }
  };
}
