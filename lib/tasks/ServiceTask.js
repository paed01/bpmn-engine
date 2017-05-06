'use strict';

const BaseTask = require('../activities/BaseTask');
const expressions = require('../expressions');

function ServiceTask() {
  BaseTask.apply(this, arguments);
  this.service = getService.call(this, this.activity, this.parentContext);
  this.resultVariable = this.activity.resultVariable;

  if (!this.service) throw new Error(`No service defined for <${this.id}>`);
}

ServiceTask.prototype = Object.create(BaseTask.prototype);

ServiceTask.prototype.execute = function(input, callback) {
  this._debug(`<${this.id}> execute ${this.service.name}`);
  this.taken = true;
  this.emit('start', this);

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
  return this.service.execute(this, input, serviceCallback);
};

// ServiceTask.prototype.getInput = function(message) {
//   if (!this.io) return this.parentContext.getVariablesAndServices(message);
//   return this.io.getInput(message, true);
// };

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

module.exports = ServiceTask;
