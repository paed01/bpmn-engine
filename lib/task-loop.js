'use strict';

const debug = require('debug')('bpmn-engine:task-loop');

function TaskLoop(activity, message, onTaskStart, onTaskCompleteCallback) {
  const executionContext = activity.parentContext.getVariablesAndServices();
  const loop = activity.loop.getLoop(executionContext);

  let activitySignal;
  if (activity.signal) {
    activitySignal = activity.signal;
  }

  const loopResult = [];
  const executions = [];

  function onComplete(callback) {
    if (loop.isSequential) {
      debug(`<${activity.id}> sequential loop execution completed`);
      if (activitySignal) {
        activity.signal = activitySignal;
      }
      return callback(null, loopResult);
    } else if (executions.length === 0) {
      debug(`<${activity.id}> parallell loop execution completed`);
      if (activitySignal) {
        activity.signal = activitySignal;
      }
      return callback(null, loopResult);
    }
  }

  function executeFn(next, onLoopComplete) {
    const messageScope = loop.next();
    const loopIndex = messageScope.index;
    messageScope.loop = true;

    if (loop.isComplete(loopIndex)) {
      return onComplete(onLoopComplete);
    }

    const execution = activity.getExecution(messageScope, executionContext);
    executions.push(execution);

    onTaskStart(execution, loopIndex);

    function executeCallback(err, result) {
      if (err) return onLoopComplete(err);

      loopResult[loopIndex] = result;

      onTaskCompleteCallback(null, execution, loopIndex);

      executions.pop();
      if (loop.isComplete(loopIndex, loopResult)) {
        return onComplete(onLoopComplete);
      }

      if (loop.isSequential) {
        next(null, execution);
      }
    }

    if (activity.signal) {
      activity.signal = function(signalInput) {
        activitySignal.call(activity, signalInput);
        executeCallback(null, signalInput);
      };
    }

    const input = execution.getInput();
    input.result = loopResult;
    activity.execute(input, executeCallback);

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
