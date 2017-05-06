'use strict';

const BaseTask = require('../activities/BaseTask');
const scriptHelper = require('../script-helper');

function ScriptTask(activity) {
  if (!scriptHelper.isJavascript(activity.scriptFormat)) throw new Error(`Script format ${activity.scriptFormat} is unsupported (<${activity.id}>)`);

  BaseTask.apply(this, arguments);
  this.script = scriptHelper.parse(`${this.id}.script`, this.activity.script);
}

ScriptTask.prototype = Object.create(BaseTask.prototype);

ScriptTask.prototype.execute = function(input, callback) {
  this._debug(`<${this.id}> execute`);
  this.taken = true;
  this.emit('start', this);

  function completeCallback(err, result) {
    if (err) return callback(err);
    return callback(null, result);
  }

  return this.executeScript(input, completeCallback);
};

ScriptTask.prototype.executeScript = function(executionContext, callback) {
  scriptHelper.execute(this.script, executionContext, callback);
};

module.exports = ScriptTask;
