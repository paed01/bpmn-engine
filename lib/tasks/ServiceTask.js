'use strict';

const BaseTask = require('../activities/BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.ServiceTask = function() {
  BaseTask.apply(this, arguments);
  this.serviceName = this.parentContext.getElementServiceName(this.activity);
};

util.inherits(internals.ServiceTask, BaseTask);

internals.ServiceTask.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, `execute ${this.serviceName}`);
  this.taken = true;
  this.emit('start', this);

  const scope = this;

  function serviceCallback(err) {
    if (err) return scope.emit('error', err, scope);

    scope.complete({
      result: Array.prototype.slice.call(arguments, 1)
    });
  }

  const serviceFn = this.parentContext.getServiceByName(this.serviceName);

  if (message && Array.isArray(message.arguments)) {
    this._debug(`<${scope.id}>`, `execute ${this.serviceName} with arguments`, message.arguments);
    const args = message.arguments.concat([serviceCallback]);
    return serviceFn.apply(null, args);
  }

  const executionContext = Object.assign({}, this.parentContext.getVariablesAndServices(), message);
  return serviceFn(executionContext, serviceCallback);
};
