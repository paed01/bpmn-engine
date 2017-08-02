'use strict';

const expressions = require('../expressions');

module.exports = ActivityExecution;

module.exports.resume = function resumeExecution(state, ...args) {
  const activityExecution = ActivityExecution(...args);
  if (state.form) {
    activityExecution.getForm().resume(state.form);
  }
  if (state.formKey) {
    activityExecution.formKey = state.formKey;
  }
  return activityExecution;
};

function ActivityExecution(activity, message, environment, inboundFlow, rootFlow) {
  const executionId = generateId();
  const activityId = activity.id;
  const type = activity.type;
  const activityForm = activity.form;
  const activityFormKey = activity.formKey;
  const io = activity.io;
  const outbound = activity.outbound;

  let form, formKey, stopped;

  const states = [];
  const stops = [];
  const pendingFork = outbound.length > 1;
  let pendingOutbound, savedState;

  let id = activityId;
  if (message && message.loop && !message.isSequential) {
    id = `${activityId}_${generateId()}`;
  }

  const outputParameters = io && io.output;

  let inputResult, resultData;
  const iterations = [];

  const variableInputContext = environment.getVariablesAndServices(getInput(), false);

  const executionContext = {
    activityId,
    id,
    executionId,
    io,
    type,
    environment,
    iterations,
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
    getForm,
    getFormKey,
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

  function getState(override) {
    const state = activity.getState ? activity.getState() : {};
    if (form) {
      state.form = getForm().getState();
    }
    if (formKey) {
      state.formKey = getFormKey();
    }

    if (pendingFork) {
      state.pendingOutbound = getPendingOutbound().map((f) => f.id);
    }

    states.forEach((fn) => Object.assign(state, fn()));

    if (iterations.length) {
      state.loop = iterations.map((itr) => itr.getState());
    }

    return Object.assign(state, override, savedState);
  }

  function addStateSource(getStateFn) {
    states.push(getStateFn);
  }

  function applyState(state) {
    if (state.pendingOutbound) {
      pendingOutbound = state.pendingOutbound.map((stateFlowId) => outbound.find((flow) => flow.id === stateFlowId));
    }
  }

  function addStopFn(stopFn) {
    stops.push(stopFn);
  }

  function setState(state) {
    savedState = state;
  }

  function getInput() {
    if (!io) return;
    if (inputResult) return inputResult;
    inputResult = io.getInput(message);
    return inputResult;
  }

  function getIteration(loopMessage) {
    const iterationEnvironment = environment.clone(loopMessage);
    const loopExecution = ActivityExecution(activity, loopMessage, iterationEnvironment, inboundFlow, rootFlow);

    iterations.push(loopExecution);

    return loopExecution;
  }

  function assignResult(data) {
    resultData = resultData || {};
    Object.assign(resultData, data);
    io.setResult(resultData);
  }

  function setResult(data) {
    resultData = data;
    io.setResult(resultData);
  }

  function getOutput() {
    return (io && io.getOutput(resultData));
  }

  function getContextInput(freeze) {
    return environment.getVariablesAndServices(getInput(), freeze);
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

  function cancel() {
    activity.cancel();
  }

  function discard() {
    activity.discard(inboundFlow, rootFlow);
  }

  function getForm() {
    if (!executionContext.form) {
      activateForm();
    }
    return executionContext.form;
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

  function activateForm() {
    if (activityForm) {
      executionContext.form = form = activityForm.activate(getContextInput({
        id
      }));
    }
    formKey = resolveFormKey();
    if (formKey) executionContext.formKey = form;

    function resolveFormKey() {
      if (!activityFormKey) return;
      if (!expressions.hasExpression(activityFormKey)) return activityFormKey;
      return expressions(activityFormKey, variableInputContext);
    }
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

  function getFormKey() {
    return formKey;
  }
}

function generateId() {
  const min = 11000;
  const max = 999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}
