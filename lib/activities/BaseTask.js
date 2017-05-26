'use strict';

const Activity = require('./Activity');
const TaskLoop = require('../task-loop');

function BaseTask() {
  Activity.apply(this, arguments);
  this.loop = this.parentContext.getLoopCharacteristics(this.activity.loopCharacteristics);
}

BaseTask.prototype = Object.create(Activity.prototype);

BaseTask.prototype.run = function(message) {
  Activity.prototype.run.apply(this, arguments);

  if (this.loop) {
    return this.runLoop(message);
  }

  this._debug(`<${this.id}> run`);
  const executionContext = this.getExecutionContext(message, this.parentContext.getVariablesAndServices());
  this.getInput = executionContext.getInput;

  this.execute(executionContext, (err, result) => {
    if (err) return this.emit('error', err, this);

    if (result !== undefined) {
      executionContext.setResult(result);
    }

    this.getOutput = executionContext.getOutput;

    this.complete(this.getOutput());
  });
};

BaseTask.prototype.execute = function(executionContext, callback) {
  this.emit('start', executionContext.getActivityApi());
  callback(null, executionContext.getOutput());
};

BaseTask.prototype.runLoop = function(message) {
  const scope = this;
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

  return executionLoop.execute((err, result) => {
    if (err) return scope.emit('error', err, scope);
    lastExecution.setResult(result);
    scope.getOutput = lastExecution.getOutput;
    scope.complete(lastExecution.getOutput());
  });
};

BaseTask.prototype.complete = function(output) {
  this.taken = true;
  this._debug(`<${this.id}> end`);
  this.emit('end', this, output);
  this.takeAllOutbound(output);
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
