'use strict';

const expressions = require('../expressions');
const Form = require('./Form');

module.exports = function execution(activity, message, variablesAndServices, inboundFlow, rootFlow) {
  const activityId = activity.id;
  const type = activity.type;
  const inbound = activity.inbound;
  let pendingInbound;

  let id = activityId;
  if (message && message.loop && !message.isSequential) {
    id = `${activityId}_${generateId()}`;
  }

  const io = activity.io;
  const inputParameters = io && io.input;
  const outputParameters = io && io.output;

  let resultData;
  let inputResult;

  const executionContext = {
    id,
    type: activity.type,
    activity,
    cancel,
    discard,
    inboundFlow,
    rootFlow,
    getState,
    getInput,
    postpone,
    setResult,
    hasOutputParameters: !!outputParameters,
    getOutput,
    getActivityApi,
    getPendingInbound,
    resolveExpression
  };

  function getInput() {
    if (inputResult) return inputResult;

    if (!inputParameters) {
      return Object.assign({}, message, variablesAndServices);
    }

    inputResult = {};
    inputParameters.forEach((parm) => {
      inputResult[parm.name] = parm.getInputValue(message, variablesAndServices);
    });

    return inputResult;
  }

  function setResult(data) {
    resultData = data;
  }

  function getOutput() {
    if (!outputParameters) {
      return resultData;
    }

    const result = {};
    const variablesAndServicesWithInput = Object.assign({}, variablesAndServices, getInput());

    outputParameters.forEach((parm) => {
      result[parm.name] = parm.getOutputValue(resultData, variablesAndServicesWithInput);
    });

    return result;
  }

  function postpone(executeCallback) {
    const activityApi = getActivityApi({
      waiting: true
    });

    if (activity.form) {
      activityApi.form = getForm();
    }

    activityApi.signal = function(input) {
      executeCallback(null, input);
    };
    activityApi.complete = function(...args) {
      executeCallback(null, ...args);
    };

    return activityApi;
  }

  function getState() {
    return activity.getState();
  }

  function cancel() {
    activity.cancel();
  }

  function discard() {
    activity.discard(inboundFlow, rootFlow);
  }

  function getForm() {
    const form = new Form(activity.form.formData);
    form.init(getInput(), variablesAndServices);
    return form;
  }

  function getActivityApi(override) {
    return Object.assign({
      id: id,
      type: type,
      activity: activity,
      cancel: cancel,
      getInput: getInput,
      getState: getState,
      getOutput: getOutput
    }, override);
  }

  function resolveExpression(expression, from) {
    return expressions(expression, from || variablesAndServices);
  }

  function getPendingInbound() {
    if (pendingInbound) return pendingInbound;

    if (!inbound || !inbound.length) return [];
    if (!inboundFlow) return inbound;

    const result = inbound.slice();

    const inboundIndex = inbound.indexOf(inboundFlow);
    if (inboundIndex > -1) {
      result.splice(inboundIndex, 1);
    }

    pendingInbound = result;

    return result;
  }

  return executionContext;
};

function generateId() {
  const min = 11000;
  const max = 999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}
