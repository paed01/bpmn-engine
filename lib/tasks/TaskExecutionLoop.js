'use strict';

const Debug = require('debug');

module.exports = function TaskExecutionLoop(activityApi, executionContext, activityExecuteFn, emit) {
  const {id, type, loop} = activityApi;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}:loop`);

  const loopContext = loop.activate(activityApi, executionContext.getContextInput());
  const isSequential = loop.isSequential;
  const loopType = isSequential ? 'sequential' : 'parallell';

  const loopResult = [];
  const completed = [];
  const executions = [];

  executionContext.addStopFn(stop);
  executionContext.addStateSource(getState);

  const loopApi = {
    id,
    type,
    execute,
    getExecuting,
    getState,
    resume,
    stop
  };

  return loopApi;

  function execute(callback) {
    function next(err) {
      if (err) return callback(err);
      executeFn(next, callback);
    }

    executeFn(next, (err, result) => {
      callback(err, result);
    });
  }

  function resume(state, callback) {
    debug(`<${id}> resume loop`);
    state.completed.forEach((item) => {
      loopResult[item.index] = item.output;
    });

    loopContext.resume(state);

    function resumeNext(err) {
      if (err) return callback(err);
      executeFn(resumeNext, callback);
    }

    executeFn(resumeNext, (err, result) => {
      callback(err, result);
    });
  }

  function getState() {
    return {
      completed: completed.map((e) => e.getState()),
      loop: executions.map((e) => e.getState())
    };
  }

  function getExecuting() {
    return executions;
  }

  function onComplete(callback) {
    if (isSequential) {
      debug(`<${id}> sequential loop execution completed`);
      return callback(null, loopResult);
    } else if (executions.length === 0) {
      debug(`<${id}> parallell loop execution completed`);
      return callback(null, loopResult);
    }
  }

  function executeFn(next, onLoopComplete) {
    const messageScope = loopContext.next();

    const loopIndex = messageScope.index;
    messageScope.loop = true;

    const loopExecution = executionContext.getIteration(messageScope);
    if (loopContext.isComplete(loopIndex, loopExecution)) {
      return onComplete(onLoopComplete);
    }

    debug(`<${loopExecution.id}> start iteration ${loopIndex} in ${loopType} loop`);

    executions.push(loopExecution);

    emit('start', loopApi, loopExecution);

    if (loopExecution.isStopped()) return;

    activityExecuteFn(loopExecution, executeCallback);

    if (!isSequential) {
      if (loopContext.isComplete(loopIndex, loopExecution)) {
        debug(`<${id}> all parallell loop executions started`);
      } else {
        next(null, loopExecution);
      }
    }

    function executeCallback(err, result) {
      if (err) return onLoopComplete(err);

      loopExecution.setResult(result);
      loopResult[loopIndex] = loopExecution.getOutput();

      completed.push(loopExecution);
      executions.splice(executions.indexOf(loopExecution), 1);

      debug(`<${loopExecution.id}> iteration ${loopIndex} completed`);

      emit('end', loopApi, loopExecution);

      if (loopContext.isComplete(loopIndex, loopExecution, loopResult)) {
        return onComplete(onLoopComplete);
      }

      if (isSequential) {
        next(null, loopExecution);
      }
    }
  }

  function stop() {
    debug(`<${id}> stop loop`);
    loopContext.stop();
    executions.forEach((e) => e.stop());
  }
};
