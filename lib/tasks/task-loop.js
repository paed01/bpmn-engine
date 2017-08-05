'use strict';

const Debug = require('debug');
const expressions = require('../expressions');
const scriptHelper = require('../script-helper');

module.exports = function TaskLoop(loop, executionContext, activityExecuteFn, emit) {
  const id = executionContext.id;
  const type = executionContext.type;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}:loop`);

  const loopCharacteristics = LoopCharacteristics(loop);
  const loopContext = loopCharacteristics.getLoop(executionContext);
  const isSequential = loopCharacteristics.isSequential;
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

      loopResult[loopIndex] = result;
      loopExecution.setResult(result);

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

function LoopCharacteristics(characteristics) {
  const hasCardinality = characteristics.hasCardinality;
  const hasCondition = characteristics.hasCondition;
  const hasCollection = characteristics.hasCollection;
  const isSequential = characteristics.isSequential;
  const debug = Debug('bpmn-engine:loop-characteristics');

  let complete = false;

  return Object.assign({}, characteristics, {
    getLoop
  });

  function getLoop(executionContext) {
    const id = executionContext.id;
    const collection = getCollection();
    const cardinality = getCardinality();
    let resumed, completed = [], stopped;
    let iteration = 0;

    executionContext.addStateSource(getState);

    return {
      isComplete,
      isSequential,
      resume,
      next,
      stop
    };

    function next() {
      const idx = getIteration();

      const data = {
        index: idx
      };
      if (collection) {
        data.item = collection[idx];
      }
      data.isSequential = isSequential;

      ++iteration;

      return data;
    }

    function resume(state) {
      resumed = true;
      if (!state.completed) return;
      debug(`resume with ${state.completed.length} completed`);
      completed = state.completed.map(({index}) => index);
    }

    function getState() {
      return {
        cardinality,
        isSequential,
        stopped
      };
    }

    function getIteration() {
      if (resumed && completed.includes(iteration)) {
        ++iteration;
        return getIteration();
      }
      return iteration;
    }

    function isComplete(idx, loopExecution, executionResult) {
      if (complete || stopped) return true;

      if (collection && collection.length === idx) {
        debug(`<${id}> reached end of collection`);
        complete = true;
      }

      if (!complete && hasCondition) {
        debug(`<${id}> execute condition`);
        complete = executeCondition(loopExecution, {result: executionResult});
      }

      if (!complete && hasCardinality) {
        const cardinalityReached = (idx + 1) > cardinality;
        if (cardinalityReached) {
          debug(`<${id}> cardinality ${cardinality} reached`);
          complete = true;
        }
      }

      return complete;
    }

    function stop() {
      stopped = true;
    }

    function getCollection() {
      if (!hasCollection) return;

      debug(`<${id}> has collection`);
      return executionContext.resolveExpression(characteristics.collection);
    }

    function getCardinality() {
      if (!hasCardinality) return;

      if (characteristics.cardinalityExpression) return executionContext.resolveExpression(characteristics.cardinalityExpression);
      return characteristics.cardinality;
    }

    function executeCondition({environment}, message) {
      if (characteristics.condition) {
        return scriptHelper.executeWithMessage(characteristics.condition, environment.getVariablesAndServices(), message);
      }

      return expressions(characteristics.conditionExpression, environment.getVariablesAndServices(message));
    }
  }
}
