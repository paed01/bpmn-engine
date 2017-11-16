'use strict';

const getNormalizedResult = require('../getNormalizedResult');

module.exports = function ActivityExecution(parentApi, message, environment) {
  const executionId = generateId();
  const {id: activityId, io, outbound, type} = parentApi;

  const stateSources = [], ioSources = [], iterations = [], stops = [];
  const isLoopContext = message && message.loop;
  let executionIo, inputResult, stopped, waiting;

  let id = activityId;

  if (isLoopContext && !message.isSequential) {
    id = `${activityId}_${generateId()}`;
  }

  const executionApi = {
    activityId,
    id,
    executionId,
    type,
    iterations,
    addIoSource,
    addStateSource,
    addStopFn,
    getInputContext,
    getForm,
    getInput,
    getIo,
    getIteration,
    getOutput,
    getState,
    isLoopContext,
    isStopped,
    postpone,
    resolveExpression,
    resume,
    save,
    setInputValue,
    setResult,
    signal,
    stop,
    takeAllOutbound,
    discardAllOutbound
  };

  return executionApi;

  function resume(state) {
    executionIo = io.resume(parentApi, state);
    return executionApi;
  }

  function getState() {
    const result = {};
    if (waiting) {
      result.waiting = waiting;
    }
    if (executionIo) {
      Object.assign(result, executionIo.getState());
    }

    stateSources.forEach((fn) => Object.assign(result, fn()));

    if (isLoopContext) {
      result.index = message.index;
      result.input = getInput();
      result.output = getOutput();
    }

    return result;
  }

  function addStateSource(getStateFn) {
    stateSources.push(getStateFn);
  }

  function addIoSource(ioSource) {
    ioSources.push(ioSource);
  }

  function addStopFn(stopFn) {
    stops.push(stopFn);
  }

  function getInput(override) {
    const activityIo = getIo();
    inputResult = inputResult || activityIo.getInput();
    if (override) {
      inputResult = Object.assign({}, inputResult, override);
    }

    if (!ioSources.length) return inputResult;

    const srcInputs = ioSources.reduce((srcResult, ioSrc) => {
      Object.assign(srcResult, getNormalizedResult(ioSrc.getInput()));
      return srcResult;
    }, {});

    const normalizedResult = getNormalizedResult(inputResult);
    return Object.assign({}, normalizedResult, srcInputs);
  }

  function setInputValue(name, value) {
    getIo().setInputValue(name, value);
  }

  function getIteration(loopMessage) {
    executionApi.isLooped = true;
    const loopExecution = ActivityExecution(parentApi, loopMessage, environment);

    iterations.push(loopExecution);

    return loopExecution;
  }

  function setResult(...args) {
    getIo().setResult(...args);
  }

  function getInputContext(freeze) {
    const override = {};
    if (executionApi.resumed) {
      override.resumed = true;
    }

    return environment.getVariablesAndServices(getInput(override), freeze);
  }

  function getOutput() {
    const ioOutput = getIo().getOutput();
    if (!ioSources.length) return ioOutput;

    const srcOutputs = ioSources.reduce((srcResult, ioSrc) => {
      Object.assign(srcResult, getNormalizedResult(ioSrc.getOutput()));
      return srcResult;
    }, getNormalizedResult(ioOutput) || {});

    return srcOutputs;
  }

  function save() {
    getIo().save();
  }

  function postpone(executeCallback) {
    if (waiting) return;
    waiting = true;

    executionApi.error = function(...args) {
      execCb(...args);
    };
    executionApi.signal = function(...args) {
      execCb(null, ...args);
    };
    executionApi.complete = function(...args) {
      execCb(null, ...args);
    };

    function execCb(...args) {
      waiting = undefined;
      executeCallback(...args);
    }

    return executionApi;
  }

  function signal(...args) {
    if (!waiting) setResult(...args);
  }

  function getForm() {
    return getIo().getForm();
  }

  function resolveExpression(expression) {
    return getIo().resolveExpression(expression);
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

  function discardAllOutbound() {
    if (!outbound) return;

    outbound.forEach((flow) => {
      if (!stopped) flow.discard();
    });
  }

  function getIo() {
    if (executionIo) return executionIo;
    executionIo = io.activate(parentApi, message, environment);
    return executionIo;
  }

};

function generateId() {
  const min = 11000;
  const max = 999999;
  const rand = Math.floor(Math.random() * (max - min)) + min;

  return rand.toString(16);
}
