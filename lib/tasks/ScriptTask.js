'use strict';

const BaseTask = require('../activities/BaseTask');
const scriptHelper = require('../script-helper');

function ScriptTask(activity) {
  if (!scriptHelper.isJavascript(activity.scriptFormat)) throw new Error(`Script format ${activity.scriptFormat} is unsupported (<${activity.id}>)`);

  BaseTask.apply(this, arguments);
  this.script = scriptHelper.parse(`${this.id}.script`, this.activity.script);
}

ScriptTask.prototype = Object.create(BaseTask.prototype);

ScriptTask.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, 'execute', message);
  this.taken = true;
  this.inboundMessage = message;

  this.emit('start', this);

  const input = this.getInput(message);

  const executionContext = this.parentContext.getVariablesAndServices();
  this.executeScript(executionContext, input, (err, output) => {
    if (err) this.emit('error', err, this);
    else this.complete(output);
  });
};

ScriptTask.prototype.executeScript = function(variablesAndServices, messageOrCallback, callback) {
  scriptHelper.execute(this.script, variablesAndServices, messageOrCallback, callback);
};

module.exports = ScriptTask;
