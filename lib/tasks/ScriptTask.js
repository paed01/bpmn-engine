'use strict';

const scriptHelper = require('../script-helper');
const Task = require('../tasks/Task');

function ScriptTask(activity) {
  Task.apply(this, arguments);
  const script = activity.getScript();
  this.script = scriptHelper.parse(`${this.id}.script`, script.body);
}

ScriptTask.prototype = Object.create(Task.prototype);

module.exports = ScriptTask;

ScriptTask.prototype.execute = function(executionContext, callback) {
  const source = this.getScript();
  if (!scriptHelper.isJavascript(source.scriptFormat)) return this.emit('error', new Error(`Script format ${source.scriptFormat} is unsupported (<${this.id}>)`));

  const script = scriptHelper.parse(`${executionContext.id}.script`, source.body);

  if (executionContext.isStopped()) {
    return;
  }

  return scriptHelper.execute(script, executionContext.getInput(), callback);
};

