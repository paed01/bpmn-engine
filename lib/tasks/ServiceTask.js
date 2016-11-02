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
  this._debug(`<${this.id}>`, 'execute', message);
  this.taken = true;
  this.inboundMessage = message;

  this.emit('start', this);
  const serviceFn = this.parentContext.getServiceByName(this.serviceName);

  const executionContext = this.parentContext.getVariablesAndServices();

  return serviceFn(Object.assign(executionContext, message), (err, output) => {
    if (err) this.emit('error', err, this);
    else this.complete(output);
  });
};
