'use strict';

const expressions = require('../expressions');
const Form = require('./Form');

module.exports = function execution(activity, message, environment, inboundFlow, rootFlow) {
  const activityId = activity.id;
  const type = activity.type;
  const form = activity.form;
  const io = activity.io;
  const outbound = activity.outbound;

  let stopped;

  const states = [];
  const stops = [];
  const pendingFork = outbound.length > 1;
  let pendingOutbound, savedState;

  let id = activityId;
  if (message && message.loop && !message.isSequential) {
    id = `${activityId}_${generateId()}`;
  }

  const inputParameters = io && io.input;
  const outputParameters = io && io.output;

  let resultData;
  let inputResult;

  const executionContext = {
    activityId,
    id,
    type,
    environment,
    activity,
    assignResult,
    addStateSource,
    addStopFn,
    cancel,
    discard,
    hasOutputParameters: !!outputParameters,
    inboundFlow,
    rootFlow,
    applyState,
    getContextInput,
    getContextOutput,
    getInput,
    getIteration,
    getOutput,
    getPendingOutbound,
    getState,
    isStopped,
    postpone,
    resolveExpression,
    setResult,
    setState,
    stop,
    takeAllOutbound
  };

  return executionContext;

  function applyState(state) {
    if (state.pendingOutbound) {
      pendingOutbound = state.pendingOutbound.map((stateFlowId) => outbound.find((flow) => flow.id === stateFlowId));
    }
  }

  function addStateSource(getStateFn) {
    states.push(getStateFn);
  }
  function addStopFn(stopFn) {
    stops.push(stopFn);
  }

  function setState(state) {
    savedState = state;
  }

  function getInput() {
    if (inputResult) return inputResult;

    if (!inputParameters) {
      return environment.getVariablesAndServices();
    }

    inputResult = {};
    inputParameters.forEach((parm) => {
      inputResult[parm.name] = parm.getInputValue(message, environment.getVariablesAndServices());
    });

    return inputResult;
  }

  function getIteration(loopMessage) {
    const iterationEnvironment = environment.clone(loopMessage);
    return execution(activity, loopMessage, iterationEnvironment, inboundFlow, rootFlow);
  }

  function assignResult(data) {
    resultData = resultData || {};
    Object.assign(resultData, data);
  }

  function setResult(data) {
    resultData = data;
  }

  function getOutput() {
    if (!outputParameters) {
      return resultData;
    }

    const result = {};
    const variablesAndServicesWithInput = Object.assign({}, environment.getVariablesAndServices(), getInput());

    outputParameters.forEach((parm) => {
      result[parm.name] = parm.getOutputValue(resultData, variablesAndServicesWithInput);
    });

    return result;
  }

  function getContextInput() {
    return environment.getVariablesAndServices(getInput());
  }

  function getContextOutput() {
    const result = getContextInput();

    if (outputParameters) {
      outputParameters.forEach((parm) => {
        result[parm.name] = parm.getOutputValue(resultData, result);
      });
    }

    return result;
  }

  function postpone(executeCallback) {
    if (form) {
      executionContext.form = getForm();
    }

    executionContext.error = function(err) {
      executeCallback(err);
    };
    executionContext.signal = function(input) {
      executeCallback(null, input);
    };
    executionContext.complete = function(...args) {
      executeCallback(null, ...args);
    };

    return executionContext;
  }

  function getState(override) {
    const state = activity.getState ? activity.getState() : {};
    if (form) {
      state.form = getForm();
    }

    if (pendingFork) {
      state.pendingOutbound = getPendingOutbound().map((f) => f.id);
    }

    states.forEach((fn) => Object.assign(state, fn()));

    return Object.assign(state, override, savedState);
  }

  function cancel() {
    activity.cancel();
  }

  function discard() {
    activity.discard(inboundFlow, rootFlow);
  }

  function getForm() {
    const formInstance = new Form(form.formData);
    formInstance.init(getInput(), environment);
    return formInstance;
  }

  function resolveExpression(expression, from) {
    return expressions(expression, from || environment);
  }

  function getPendingOutbound() {
    if (pendingOutbound) return pendingOutbound;

    pendingOutbound = outbound.slice();

    if (pendingOutbound.length > 1) {
      const defaultFlow = outbound.find((flow) => flow.isDefault);
      if (defaultFlow) {
        pendingOutbound.splice(pendingOutbound.indexOf(defaultFlow), 1);
        pendingOutbound.push(defaultFlow);
      }
    }

    return pendingOutbound;
  }

  function stop() {
    stopped = true;
    stops.forEach((fn) => fn());
    stops.splice(0);
  }

  function isStopped() {
    return stopped;
  }

  function takeAllOutbound(flowMessage) {
    if (!outbound) return !stopped;
    if (!flowMessage) flowMessage = getOutput();

    outbound.forEach((flow) => {
      if (!stopped) flow.take(flowMessage);
    });

    return !stopped;
  }
};

function generateId() {
  const min = 11000;
  const max = 999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}
