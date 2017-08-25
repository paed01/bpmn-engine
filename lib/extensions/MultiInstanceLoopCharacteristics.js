'use strict';

const Debug = require('debug');
const expressions = require('../expressions');
const scriptHelper = require('../script-helper');

module.exports = function MultiInstanceLoopCharacteristics(loopCharacteristics) {
  const characteristics = {
    isSequential: loopCharacteristics.isSequential
  };

  if (loopCharacteristics.collection) {
    characteristics.type = 'collection';
    characteristics.collection = loopCharacteristics.collection;
    characteristics.hasCollection = true;
  }

  if (loopCharacteristics.completionCondition && loopCharacteristics.completionCondition.body) {
    if (expressions.isExpression(loopCharacteristics.completionCondition.body)) {
      characteristics.conditionExpression = loopCharacteristics.completionCondition.body;
    } else {
      characteristics.condition = scriptHelper.parse('characteristics.condition', loopCharacteristics.completionCondition.body);
    }
    characteristics.type = characteristics.type || 'condition';
    characteristics.hasCondition = true;
  }

  if (loopCharacteristics.loopCardinality && loopCharacteristics.loopCardinality.body) {
    if (expressions.isExpression(loopCharacteristics.loopCardinality.body)) {
      characteristics.cardinalityExpression = loopCharacteristics.loopCardinality.body;
    } else {
      const cardinality = Number(loopCharacteristics.loopCardinality.body);
      if (!isNaN(cardinality)) {
        characteristics.cardinality = cardinality;
      }
    }

    if ((characteristics.cardinalityExpression || !isNaN(characteristics.cardinality))) {
      characteristics.hasCardinality = true;
      characteristics.type = characteristics.type || 'cardinality';
    }
  }

  characteristics.getLoop = LoopCharacteristics(characteristics).getLoop;

  return characteristics;
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
    let completed = [], resumed, stopped;
    let iteration = 0;

    executionContext.addStateSource(getState);

    return {
      cardinality,
      isComplete,
      isSequential,
      resume,
      next,
      stop
    };

    function next() {
      const idx = getIteration();

      const data = {
        index: idx,
        isSequential,
        cardinality
      };
      if (collection) {
        data.item = collection[idx];
      }

      if (resumed) {
        if (resumed.find(({index}) => idx === index)) {
          data.resumed = true;
        }
      }

      ++iteration;

      return data;
    }

    function resume(state) {
      resumed = state.loop;
      if (!state.completed) return;
      debug(`resume with ${state.completed.length} completed`);
      completed = state.completed.map(({index}) => index);
    }

    function getState() {
      const result = {
        cardinality,
        isSequential
      };

      if (stopped) {
        result.stopped = stopped;
      }

      return result;
    }

    function getIteration() {
      if (resumed && completed.includes(iteration)) {
        ++iteration;
        return getIteration();
      }
      return iteration;
    }

    function isComplete(idx, loopActivityExecution, executionResult) {
      if (complete || stopped) return true;

      if (collection && collection.length === idx) {
        debug(`<${id}> reached end of collection`);
        complete = true;
      }

      if (!complete && hasCondition) {
        debug(`<${id}> execute condition`);
        complete = executeCondition(loopActivityExecution, {result: executionResult});
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
      let value = characteristics.cardinality;
      if (characteristics.cardinalityExpression) {
        value = executionContext.resolveExpression(characteristics.cardinalityExpression);
      }
      return Number(value);
    }

    function executeCondition({environment}, message) {
      if (characteristics.condition) {
        return scriptHelper.executeWithMessage(characteristics.condition, environment.getVariablesAndServices(), message);
      }

      return expressions(characteristics.conditionExpression, environment.getVariablesAndServices(message));
    }
  }
}
