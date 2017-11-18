'use strict';

const Debug = require('debug');
const expressions = require('../expressions');
const Flow = require('./Flow');
const scriptHelper = require('../script-helper');

module.exports = function SequenceFlow(activity, parentContext) {
  const flowApi = Flow(activity, parentContext);
  const {id, type} = flowApi;
  const {environment} = parentContext;
  const isDefault = parentContext.isDefaultSequenceFlow(id);
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const condition = getCondition();

  flowApi.isDefault = isDefault;
  flowApi.evaluateCondition = evaluateCondition;

  return flowApi;

  function evaluateCondition(input) {
    if (!condition) return true;
    const executionContext = environment.getFrozenVariablesAndServices(Object.assign({flowId: id}, input || {}));
    return executeCondition(executionContext);
  }

  function executeCondition(context) {
    const result = condition.execute(context);
    debug(`<${id}> condition result evaluated to ${result}`);
    return result;
  }

  function getCondition() {
    const element = activity.element;
    if (!element) return;
    if (!element.conditionExpression) return null;

    if (!element.conditionExpression.hasOwnProperty('language')) {
      return ExpressionCondition(element.conditionExpression.body);
    }

    if (!scriptHelper.isJavascript(element.conditionExpression.language)) throw Error(`Script format ${element.conditionExpression.language} is unsupported (<${element.id}>)`);

    return ScriptCondition(scriptHelper.parse(`${element.id}.condition`, element.conditionExpression.body));
  }
};

function ScriptCondition(script) {
  return {
    execute: (executionContext) => {
      return scriptHelper.execute(script, executionContext);
    }
  };
}

function ExpressionCondition(expression) {
  return {
    execute: (executionContext) => {
      return expressions(expression, executionContext);
    }
  };
}
