'use strict';

const Debug = require('debug');

module.exports = function TaskLoop(executionContext, onTaskStart, onTaskCompleteCallback) {
  const scope = executionContext.activity;
  const id = executionContext.id;
  const type = executionContext.type;
  const loopCharacteristics = LoopCharacteristics(scope.loop);

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}:loop`);

  const loopContext = loopCharacteristics.getLoop(executionContext);
  const isSequential = loopCharacteristics.isSequential;
  const loopType = isSequential ? 'sequential' : 'parallell';

  const loopResult = [];
  const executions = [];

  return {
    execute: execute
  };

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

    if (loopContext.isComplete(loopIndex, messageScope)) {
      return onComplete(onLoopComplete);
    }

    const execution = executionContext.getIteration(messageScope);
    executions.push(execution);

    onTaskStart(execution, loopIndex, loopResult);

    function executeCallback(err, result) {
      if (err) return onLoopComplete(err);

      loopResult[loopIndex] = result;

      onTaskCompleteCallback(null, execution, loopIndex);

      executions.pop();
      if (loopContext.isComplete(loopIndex, messageScope, loopResult)) {
        return onComplete(onLoopComplete);
      }

      if (isSequential) {
        next(null, execution);
      }
    }

    const input = execution.getInput();
    if (execution.hasOutputParameters) {
      input._result = execution.getOutput();
    }

    scope.execute(execution, executeCallback);

    if (!isSequential) {
      if (loopContext.isComplete(loopIndex)) {
        debug(`<${id}> all parallell loop executions started`);
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

    function isComplete(idx, iterationData, executionResult) {
      if (complete) return complete;

      if (collection && collection.length === idx) {
        debug(`<${id}> reached end of collection`);
        complete = true;
      }

      if (!complete && hasCondition && executionResult) {
        debug(`<${id}> execute condition`);
        complete = executeCondition(characteristics, Object.assign({}, executionContext, iterationData), {result: executionResult});
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
      return list;
    }

    function getCardinality() {
      if (!hasCardinality) return;

      if (characteristics.cardinalityExpression) return executionContext.resolveExpressions(characteristics.cardinalityExpression);
      return characteristics.cardinality;
    }
  }
}
