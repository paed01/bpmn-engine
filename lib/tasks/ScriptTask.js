'use strict';

const {EventEmitter} = require('events');
const scriptHelper = require('../script-helper');
const TaskActivity = require('./task-activity');

function ScriptTask(activity) {
  Object.assign(this, activity);
  const script = activity.getScript();
  this.script = scriptHelper.parse(`${this.id}.script`, script.body);
}

ScriptTask.prototype = Object.create(EventEmitter.prototype);

module.exports = ScriptTask;

ScriptTask.prototype.run = function(message) {
  return this.activate().run(message);
};

ScriptTask.prototype.activate = function(state) {
  const task = this;
  const io = task.io;
  const {body, scriptFormat} = this.getScript();
  if (!scriptHelper.isJavascript(scriptFormat)) return this.emit('error', new Error(`Script format ${scriptFormat} is unsupported (<${task.id}>)`));

  state = state || {};
  return TaskActivity(task, execute, state);

  function execute(activityApi, executionContext, callback) {
    const script = scriptHelper.parse(`${executionContext.id}.script`, body);
    const input = io.isDefault ? executionContext.getContextInput(false) : executionContext.getInput();

    return scriptHelper.execute(script, input, callback);
  }
};
