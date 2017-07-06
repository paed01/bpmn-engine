'use strict';

const {EventEmitter} = require('events');
const scriptHelper = require('../script-helper');
const TaskActivity = require('./TaskActivity');

function ScriptTask(activity) {
  Object.assign(this, activity);
  this.isStart = !this.inbound || this.inbound.length === 0;
  const script = activity.getScript();
  this.script = scriptHelper.parse(`${this.id}.script`, script.body);
}

ScriptTask.prototype = Object.create(EventEmitter.prototype);

module.exports = ScriptTask;

ScriptTask.prototype.run = function(message) {
  this.activate().run(message);
};

ScriptTask.prototype.activate = function(state) {
  const task = this;
  const source = this.getScript();
  if (!scriptHelper.isJavascript(source.scriptFormat)) return this.emit('error', new Error(`Script format ${source.scriptFormat} is unsupported (<${this.id}>)`));

  state = state || {};
  return TaskActivity(task, execute, state);

  function execute(activityApi, executionContext, callback) {
    const script = scriptHelper.parse(`${executionContext.id}.script`, source.body);
    return scriptHelper.execute(script, executionContext.getInput(), callback);
  }
};
