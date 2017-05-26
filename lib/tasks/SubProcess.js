'use strict';

const BaseTask = require('../activities/BaseTask');
const processExecution = require('../activities/process-execution');

function SubProcess(activity, parentContext) {
  BaseTask.call(this, activity, parentContext);
  this.isSubProcess = true;
}

SubProcess.prototype = Object.create(BaseTask.prototype);

SubProcess.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}>`, 'execute');

  const Context = require('../Context');
  const context = new Context(this.id, this.parentContext.moddleContext, this.getInput());

  const listener = this.listener;

  const execution = processExecution(context, onChildEvent, callback);

  this.emit('start', executionContext.getActivityApi({
    signal: execution.signal
  }));

  execution.execute();

  function onChildEvent(eventName, activity) {
    if (!listener) return;

    listener.emit(`${eventName}-${activity.id}`, activity, execution);
    listener.emit(eventName, activity, execution);
  }
};

module.exports = SubProcess;
