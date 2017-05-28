'use strict';

const BaseTask = require('../activities/BaseTask');

function ServiceTask(activity) {
  BaseTask.apply(this, arguments);
  const service = activity.getServiceDefinition();
  this.service = service;
  this.resultVariable = service.resultVariable;

  // if (!this.service) throw new Error(`No service defined for <${this.id}>`);
}

ServiceTask.prototype = Object.create(BaseTask.prototype);

ServiceTask.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}> execute ${this.service.name}`);
  this.emit('start', executionContext.getActivityApi());

  const resultVariable = this.resultVariable;

  function serviceCallback(err, serviceResult) {
    if (err) return callback(err);

    let result = serviceResult;
    if (resultVariable) {
      result = {};
      result[resultVariable] = serviceResult;
    }

    return callback(null, result);
  }

  return this.service.execute(this, executionContext.getInput(), serviceCallback);
};

module.exports = ServiceTask;
