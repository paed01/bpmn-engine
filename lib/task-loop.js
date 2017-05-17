'use strict';

const debug = require('debug')('bpmn-engine:task-loop');

function TaskLoop(activity, message, onTaskStart, onTaskCompleteCallback) {
  const executionContext = activity.parentContext.getVariablesAndServices();
  const loop = activity.loop.getLoop(executionContext);

  const loopResult = [];
  const executions = [];

  function onComplete(callback) {
    if (loop.isSequential) {
      debug(`<${activity.id}> sequential loop execution completed`);
      return callback(null, loopResult);
    } else if (executions.length === 0) {
      debug(`<${activity.id}> parallell loop execution completed`);
      return callback(null, loopResult);
    }
  }

  function executeFn(next, onLoopComplete) {
    const messageScope = loop.next();
    const loopIndex = messageScope.index;
    messageScope.loop = true;

    if (loop.isComplete(loopIndex, messageScope)) {
      return onComplete(onLoopComplete);
    }

    const execution = activity.getExecutionContext(messageScope, executionContext);
    executions.push(execution);

    onTaskStart(execution, loopIndex, loopResult);

    function executeCallback(err, result) {
      if (err) return onLoopComplete(err);

      loopResult[loopIndex] = result;

      onTaskCompleteCallback(null, execution, loopIndex);

      executions.pop();
      if (loop.isComplete(loopIndex, messageScope, loopResult)) {
        return onComplete(onLoopComplete);
      }

      if (loop.isSequential) {
        next(null, execution);
      }
    }

    const input = execution.getInput();
    if (execution.hasOutputParameters) {
      input._result = execution.getOutput();
    }

    activity.execute(execution, executeCallback);

    if (!loop.isSequential) {
      if (loop.isComplete(loopIndex)) {
        debug(`<${activity.id}> all parallell loop execution started`);
      } else {
        next(null, execution);
      }
    }
  }

  function execute(onLoopComplete) {
    function next(err) {
      if (err) return onLoopComplete(err);
      executeFn(next, onLoopComplete);
    }

    executeFn(next, (err, result) => {
      onLoopComplete(err, result);
    });
  }

  return {
    execute: execute
  };
}

module.exports = TaskLoop;
