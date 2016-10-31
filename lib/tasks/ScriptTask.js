'use strict';

const BaseTask = require('../activities/BaseTask');
const scriptHelper = require('../script-helper');
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity) {
  if (!scriptHelper.isJavascript(activity.scriptFormat)) throw new Error(`Script format ${activity.scriptFormat} is unsupported (<${activity.id}>)`);

  BaseTask.apply(this, arguments);
  this.script = scriptHelper.parse(`${this.id}.script`, this.activity.script);
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, 'execute', message);
  this.taken = true;
  this.inboundMessage = message;

  this.emit('start', this);

  const executionContext = this.parentContext.getVariablesAndServices();
  this.executeScript(executionContext, message, (err, output) => {
    if (err) this.emit('error', err, this);
    else this.complete(output);
  });
};

internals.Task.prototype.executeScript = function(variablesAndServices, messageOrCallback, callback) {
  scriptHelper.execute(this.script, variablesAndServices, messageOrCallback, callback);
};
