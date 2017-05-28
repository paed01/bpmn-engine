'use strict';

const BaseTask = require('../activities/BaseTask');
const scriptHelper = require('../script-helper');

function ScriptTask(activity) {
  const script = activity.getScript();
  if (!scriptHelper.isJavascript(script.scriptFormat)) throw new Error(`Script format ${script.scriptFormat} is unsupported (<${activity.id}>)`);

  BaseTask.apply(this, arguments);
  this.script = scriptHelper.parse(`${this.id}.script`, this.activity.script);
}

ScriptTask.prototype = Object.create(BaseTask.prototype);

ScriptTask.prototype.execute = function(executionContext, callback) {
  this._debug(`<${this.id}> execute`);
  this.taken = true;
  this.emit('start', executionContext.getActivityApi());

  function completeCallback(err, result) {
    if (err) return callback(err);
    return callback(null, result);
  }

  return scriptHelper.execute(this.script, executionContext.getInput(), completeCallback);
};

module.exports = ScriptTask;
