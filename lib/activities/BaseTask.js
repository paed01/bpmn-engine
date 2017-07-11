'use strict';

const Activity = require('./Activity');
const TaskLoop = require('../tasks/task-loop');

function BaseTask(activity) {
  Activity.apply(this, arguments);
  this.loop = activity.loop;
}

BaseTask.prototype = Object.create(Activity.prototype);

BaseTask.prototype.run = function(...args) {
  if (this.loop) {
    return this.runLoop(...args);
  }

  Activity.prototype.run.call(this, ...args);
};

BaseTask.prototype.execute = function(executionContext, callback) {
  this.emit('start', executionContext);
  callback(null, executionContext.getOutput());
};

BaseTask.prototype.runLoop = function(message) {
  const scope = this;
  scope.canceled = false;
  scope.taken = false;
  scope.enter();

  const loopType = this.loop.isSequential ? 'sequential' : 'parallell';
  scope._debug(`<${scope.id}> start ${loopType} ${scope.loop.characteristics.type} loop`);

  function onTaskStart(currentExecution, loopIndex, currentResult) {
    scope._debug(`<${scope.id}> start iteration ${loopIndex} in ${loopType} loop`);

    currentExecution.setResult(currentResult);

    scope.getInput = currentExecution.getInput;
    scope.getOutput = currentExecution.getOutput;
  }

  let lastExecution;
  function onLoopComplete(err, currentExecution, loopIndex) {
    if (err) scope.emit('error', err, scope);
    scope._debug(`<${currentExecution.id}> iteration ${loopIndex} in ${loopType} loop completed`);
    lastExecution = currentExecution;
  }

  const executionLoop = TaskLoop(scope, message, onTaskStart, onLoopComplete);

  return executionLoop.execute((err, result, hasOutputParameters) => {
    if (err) return scope.emit('error', err, scope);
    lastExecution.setResult(result);
    scope.getOutput = lastExecution.getOutput;
    scope.complete(getTaskOutput(scope.id, hasOutputParameters || lastExecution.hasOutputParameters, lastExecution.getOutput()));
  });
};

BaseTask.prototype.complete = function(output, ...args) {
  this.taken = true;
  this._debug(`<${this.id}> end`);
  this.emit('end', this, output);
  this.takeAllOutbound(output, ...args);
};

BaseTask.prototype.deactivate = function() {
  Activity.prototype.deactivate.apply(this, arguments);
  if (this.loop) {
    this.loop.deactivate();
  }
};

BaseTask.prototype.getState = function() {
  const state = Activity.prototype.getState.apply(this, arguments);
  if (this.loop) state.loop = this.loop.getState();
  return state;
};

BaseTask.prototype.resume = function(state) {
  if (this.loop) {
    this.loop.resume(state.loop);
  }

  Activity.prototype.resume.apply(this, arguments);
};

module.exports = BaseTask;

function getTaskOutput(id, hasDefinedOutput, output) {
  if (hasDefinedOutput) {
    return output;
  }
  const result = {
    taskInput: {}
  };
  result.taskInput[id] = output;
  return result;
}
