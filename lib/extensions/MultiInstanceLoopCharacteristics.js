'use strict';

const Debug = require('debug');
const getNormalizedResult = require('../getNormalizedResult');
const {isExpression} = require('../expressions');

module.exports = function MultiInstanceLoopCharacteristics(loopCharacteristics, parentContext) {
  const {id, $type: type, isSequential, collection, completionCondition, elementVariable, loopCardinality} = loopCharacteristics;
  const {environment} = parentContext;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  const loopType = getLoopType();
  if (!loopType) return;

  return {
    id,
    type,
    loopType,
    collection,
    elementVariable,
    isSequential,
    activate
  };

  function activate(parentApi, inputContext) {
    const {id: parentId} = parentApi;
    const collectionList = getCollection();
    const cardinality = getCardinality();
    const condition = getCondition();
    const itemName = elementVariable || 'item';

    let completed = [], complete = false, resumed, stopped;
    let iteration = 0;

    return {
      type,
      loopType,
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
        isLoopContext: true,
        index: idx,
        isSequential,
        cardinality
      };
      if (collectionList) {
        data[itemName] = collectionList[idx];
      }

      if (resumed) {
        if (resumed.find(({index}) => idx === index)) {
          data.resumed = true;
        }
      }

      ++iteration;

      return data;
    }

    function isComplete(idx, loopActivityExecution, executionResult) {
      if (complete || stopped) return true;

      const {id: activityId} = loopActivityExecution;

      if (collectionList && collectionList.length === idx) {
        debug(`<${activityId}> reached end of collection`);
        complete = true;
        return complete;
      }

      if (condition) {
        debug(`<${activityId}> execute condition`);
        complete = condition(loopActivityExecution, getNormalizedResult(executionResult));
        if (complete) return complete;
      }

      if (cardinality !== undefined) {
        const cardinalityReached = (idx + 1) > cardinality;
        if (cardinalityReached) {
          debug(`<${activityId}> cardinality ${cardinality} reached`);
          complete = true;
        }
      }

      return complete;
    }

    function getIteration() {
      if (resumed && completed.includes(iteration)) {
        ++iteration;
        return getIteration();
      }
      return iteration;
    }

    function stop() {
      stopped = true;
    }

    function resume(state) {
      resumed = state.loop;
      if (!state.completed) return;
      debug(`resume with ${state.completed.length} completed`);
      completed = state.completed.map(({index}) => index);
    }

    function getCollection() {
      if (!collection) return;
      debug(`<${parentId}> has collection`);
      return environment.resolveExpression(collection, inputContext);
    }

    function getCardinality() {
      if (!loopCardinality) return;
      let value = loopCardinality.body;
      if (!value) return;

      value = environment.resolveExpression(value, inputContext);

      const nValue = Number(value);
      if (isNaN(nValue)) return NaN;

      return nValue;
    }

    function getCondition() {
      if (!completionCondition || !completionCondition.body) return;

      const cond = completionCondition.body;
      const isCondExpression = isExpression(cond);
      const scriptName = `${parentId}.loopcondition`;

      return function execute(loopActivityExecution, result) {
        let conditionContext = loopActivityExecution.getContextInput();
        if (result) conditionContext = Object.assign(conditionContext, result);
        if (isCondExpression) return environment.resolveExpression(cond, conditionContext);
        return environment.executeScript(scriptName, cond, conditionContext);
      };
    }
  }

  function getLoopType() {
    if (collection) return 'collection';
    if (completionCondition && completionCondition.body) return 'condition';
    if (loopCardinality && loopCardinality.body) return 'cardinality';
  }
};
