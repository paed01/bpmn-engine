'use strict';

const Debug = require('debug');
const expressions = require('../expressions');
const scriptHelper = require('../script-helper');

module.exports = function TaskLoop(activityApi, executionContext, loop, onTaskStart, onTaskCompleteCallback) {
  const id = executionContext.id;
  const type = executionContext.type;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}:loop`);

  const loopCharacteristics = LoopCharacteristics(loop);
  const loopContext = loopCharacteristics.getLoop(executionContext);
  const isSequential = loopCharacteristics.isSequential;
  const loopType = isSequential ? 'sequential' : 'parallell';

  const loopResult = [];
  const executions = [];

  return {
    execute: execute
  };

  function execute(onLoopComplete) {
    function next(err) {
      if (err) return onLoopComplete(err);
      executeFn(next, onLoopComplete);
    }

    executeFn(next, (err, result) => {
      onLoopComplete(err, result);
    });
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

    debug(`<${id}> start iteration ${loopIndex} in ${loopType} loop`);

    const loopExecution = executionContext.getIteration(messageScope);
    if (loopContext.isComplete(loopIndex, loopExecution)) {
      return onComplete(onLoopComplete);
    }

    executions.push(loopExecution);

    onTaskStart(loopExecution, loopIndex, loopResult);

    function executeCallback(err, result) {
      if (err) return onLoopComplete(err);

      loopResult[loopIndex] = result;

      loopExecution.setResult(result);
      onTaskCompleteCallback(null, loopExecution, loopIndex, loopResult);

      executions.pop();
      if (loopContext.isComplete(loopIndex, loopExecution, loopResult)) {
        return onComplete(onLoopComplete);
      }

      if (isSequential) {
        next(null, loopExecution);
      }
    }

    const input = loopExecution.getInput();
    if (loopExecution.hasOutputParameters) {
      input._result = loopExecution.getOutput();
    }

    activityApi.execute(activityApi, loopExecution, executeCallback);

    if (!isSequential) {
      if (loopContext.isComplete(loopIndex, loopExecution)) {
        debug(`<${id}> all parallell loop executions started`);
      } else {
        next(null, loopExecution);
      }
    }
  }
};

function LoopCharacteristics(characteristics) {
  const hasCardinality = characteristics.hasCardinality;
  const hasCondition = characteristics.hasCondition;
  const hasCollection = characteristics.hasCollection;
  const isSequential = characteristics.isSequential;
  const debug = Debug('bpmn-engine:loop-characteristics');

  let iteration = 0;
  let complete = false;

  return Object.assign({}, characteristics, {
    getLoop
  });

  function getLoop(executionContext) {
    const id = executionContext.id;
    const collection = getCollection();
    const cardinality = getCardinality();

    return {
      isSequential,
      isComplete,
      next
    };

    function next() {
      const idx = iteration;
      const data = {
        index: idx,
      };
      if (collection) {
        data.item = collection[idx];
      }
      data.isSequential = isSequential;
      iteration = idx + 1;

      return data;
    }

    function isComplete(idx, loopExecution, executionResult) {
      if (complete) return complete;

      if (collection && collection.length === idx) {
        debug(`<${id}> reached end of collection`);
        complete = true;
      }

      if (!complete && hasCondition) {
        debug(`<${id}> execute condition`);
        complete = executeCondition(loopExecution, {result: executionResult});
      }

      if (!complete && cardinality !== undefined && idx >= cardinality) {
        complete = true;
      }

      return complete;
    }

    function getCollection() {
      if (!hasCollection) return;

      let list = executionContext.resolveExpression(characteristics.collection);
      if (iteration > 0) {
        list = collection.slice(this.iteration);
      }
      debug(`<${id}> has collection`);
      return list;
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
