'use strict';

const debug = require('debug')('bpmn-engine:process-execution');
const {BpmnError} = require('./BpmnError');

module.exports = function ProcessExecution(context, onChildEvent, onComplete) {
  const id = context.id;
  const type = context.type;
  const childIds = Object.keys(context.children);
  const children = context.children;
  const messageFlows = context.messageFlows;

  const startActivities = [];

  const caughtErrors = [], activatedChildren = [], waitingActivities = [];
  let start = onStartCallback(), started = false;
  let pendingExecutions = [];
  let variablesAndServices = context.getVariablesAndServices();
  const inputOnStart = assignInput(variablesAndServices);

  const executionContext = {
    id,
    type,
    deactivate,
    execute,
    getChildActivityById,
    getChildState,
    getInput,
    getOutput,
    getState,
    resume,
    signal
  };

  return executionContext;

  function execute(onStart) {
    activate();
    debug(`<${id}> execute`);
    if (!childIds.length) return complete();
    start = onStartCallback(onStart);

    startActivities.forEach((activity) => activity.run());
  }

  function resume(state, onStart) {
    context.resume(state);

    activate(state);
    debug(`<${id}> resume`);
    if (!childIds.length) return complete();

    start = onStartCallback(onStart);

    resumeChildren(state);
  }

  function onStartCallback(callback) {
    return function() {
      started = true;
      if (callback) callback(executionContext);
    };
  }

  function resumeChildren(state) {
    variablesAndServices = context.getVariablesAndServices();

    const resumeSequences = state.children.reduce((result, childState) => {
      if (childState.entered && (childState.pendingJoin || childState.attachedToId)) {
        result.pre.push(childState);
      } else {
        result.post.push(childState);
      }

      return result;
    }, {
      pre: [],
      post: []
    });

    resumeSequences.pre.forEach((childState) => {
      const activityApi = activatedChildren.find(({id: activityId}) => childState.id === activityId);
      if (activityApi) activityApi.resume();
    });
    resumeSequences.post.forEach((childState) => {
      const activityApi = activatedChildren.find(({id: activityId}) => childState.id === activityId);
      if (activityApi) activityApi.resume();
    });
  }

  function signal(childId, input) {
    const childExecutionIdx = waitingActivities.findIndex((a) => a.id === childId);
    if (childExecutionIdx < 0) return;

    debug(`<${id}> signal <${childId}>`);

    const childExecution = waitingActivities.splice(childExecutionIdx, 1)[0];

    childExecution.signal(input);
  }

  function getState() {
    const contextState = context.getState();

    const result = {
      id,
      type,
      variablesAndServices: JSON.parse(JSON.stringify(variablesAndServices)),
      children: getChildStates()
    };

    result.variablesAndServices.services = Object.assign(result.variablesAndServices.services, contextState.variablesAndServices.services);

    return result;
  }

  function getChildState(childId) {
    const childApi = activatedChildren.find(({id: childApiId}) => childApiId === childId);
    if (childApi) return childApi.getState();
  }

  function getChildStates() {
    const childStates = [];
    activatedChildren.forEach((activeChild) => {
      if (activeChild) childStates.push(activeChild.getState());
    });
    return childStates;
  }

  function getInput() {
    return inputOnStart;
  }

  function getOutput() {
    return variablesAndServices;
  }

  function getChildActivityById(childId) {
    context.getChildActivityById(childId);
  }

  function complete(err, source) {
    deactivate();
    onComplete(err, source, executionContext);
  }

  function activate(state) {
    childIds.forEach((childId) => {
      const activity = children[childId];
      const childState = state && state.children.find((s) => s.id === childId);

      onChildEvents(activity);
      const activityApi = activity.activate(childState);
      if (activity.isStart) startActivities.push(activityApi);

      activatedChildren.push(activityApi);
    });

    messageFlows.forEach((flow) => {
      flow.on('message', onMessage);
    });
  }

  function deactivate() {
    pendingExecutions.forEach((activity) => activity.stop());

    childIds.forEach((childId) => {
      const activity = children[childId];
      offChildEvents(activity);
      if (activity.deactivate) activity.deactivate();
    });

    activatedChildren.forEach((activeChild) => {
      if (activeChild) activeChild.deactivate();
    });

    messageFlows.forEach((flow) => {
      flow.removeListener('message', onMessage);
    });
  }

  function onChildEvents(activity) {
    activity.on('enter', onChildEnter);
    activity.on('start', onChildStart);
    activity.on('wait', onChildWait);
    activity.on('end', onChildEnd);
    activity.on('cancel', onChildCancel);
    activity.on('leave', onChildLeave);
    activity.on('error', onChildError);
    activity.on('catch', onChildCatch);
  }

  function offChildEvents(activity) {
    activity.removeListener('enter', onChildEnter);
    activity.removeListener('start', onChildStart);
    activity.removeListener('wait', onChildWait);
    activity.removeListener('cancel', onChildCancel);
    activity.removeListener('end', onChildEnd);
    activity.removeListener('leave', onChildLeave);
    activity.removeListener('error', onChildError);
    activity.removeListener('catch', onChildCatch);
  }

  function onChildError(err, source) {
    if (caughtErrors.includes(err)) return;
    complete(err, source);
  }

  function onChildCatch(err) {
    debug(`<${id}> error caught from ${err.source.type} <${err.source.id}>`);
    if (err instanceof BpmnError) {
      return caughtErrors.push(err.inner);
    }

    caughtErrors.push(err);
  }

  function onChildEnter(activityApi, childExecutionContext) {
    if (!started) start();

    pendingExecutions.push(childExecutionContext);

    onChildEvent('enter', activityApi, childExecutionContext);
  }

  function onChildStart(activity, childExecutionContext) {
    onChildEvent('start', activity, childExecutionContext);
  }

  function onChildCancel(activity) {
    onChildEvent('cancel', activity);
  }

  function onChildWait(activity, childExecutionContext) {
    debug(`<${id}> wait for <${activity.id}> (${activity.type})`);
    waitingActivities.push(childExecutionContext);
    onChildEvent('wait', activity, childExecutionContext);
  }

  function onChildEnd(activity, childExecutionContext) {
    assignTaskInput(childExecutionContext);

    if (activity.terminate) {
      complete(null, activity);
    }

    onChildEvent('end', activity);
  }

  function onChildLeave(activityApi, childExecutionContext) {
    pendingExecutions = pendingExecutions.filter((c) => c !== childExecutionContext);

    debug(`<${id}> left <${childExecutionContext.id}> (${childExecutionContext.type}), pending activities ${pendingExecutions.length}`);

    onChildEvent('leave', childExecutionContext);

    if (pendingExecutions.length === 0) {
      complete(null, activityApi);
    }
  }

  function onMessage(message, flow) {
    onChildEvent('message', message, flow);
  }

  function assignInput(input) {
    const variables = Object.assign({}, input.variables);
    const services = Object.assign({}, input.services);

    return Object.assign({}, input, {
      variables,
      services
    });
  }

  function assignTaskInput(childExecutionContext) {
    if (!childExecutionContext) return;

    const taskOutput = childExecutionContext.getOutput();

    if (!taskOutput) return;
    if (!childExecutionContext.hasOutputParameters) {
      variablesAndServices.variables.taskInput = variablesAndServices.variables.taskInput || {};
      variablesAndServices.variables.taskInput[executionContext.id] = taskOutput;
    }

    Object.assign(variablesAndServices.variables, taskOutput);
  }
};
