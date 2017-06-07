'use strict';

const debug = require('debug')('bpmn-engine:process-execution');

module.exports = function ProcessExecution(context, onChildEvent, onComplete) {
  const id = context.id;
  const type = context.type;
  const childIds = Object.keys(context.children);
  const children = context.children;
  const messageFlows = context.messageFlows;

  const startActivities = context.startActivities;

  const waitingActivities = [];
  let pendingActivities = [];
  let variablesAndServices = context.getVariablesAndServices();
  const inputOnStart = assignInput(variablesAndServices);

  const executionContext = {
    id,
    type,
    applyState,
    deactivate,
    execute,
    signal,
    getChildActivityById,
    getInput,
    getOutput,
    getState,
    resume
  };

  return executionContext;

  function execute(onStart) {
    activate();
    debug(`<${id}> execute`);
    if (!childIds.length) return complete();

    startActivities.forEach((activity) => activity.run());

    if (onStart) onStart(executionContext);
  }

  function resume(state, onStart) {
    activate();
    debug(`<${id}> resume`);
    if (!childIds.length) return complete();

    startActivities.forEach((activity) => activity.run());

    if (onStart) onStart(executionContext);
  }

  function applyState(state) {
    variablesAndServices = state.variablesAndServices;
    state.children.forEach((childState) => {
      children[childState.id].resume(childState);
    });
  }

  function signal(childId, input) {
    const childExecutionIdx = waitingActivities.findIndex((a) => a.id === childId);
    if (childExecutionIdx < 0) return;

    debug(`<${id}>`, `signal <${childId}>`);

    const childExecution = waitingActivities.splice(childExecutionIdx, 1)[0];

    childExecution.signal(input);
  }

  function getState() {
    const result = {
      id,
      type,
      variablesAndServices: JSON.parse(JSON.stringify(variablesAndServices)),
      children: getChildStates()
    };

    return result;
  }

  function getChildStates() {
    return pendingActivities.map((child) => child.getState());
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

  function activate() {
    childIds.forEach((childId) => {
      const activity = children[childId];
      activateChild(activity);
      activity.activate();
    });
    messageFlows.forEach((flow) => {
      flow.on('message', onMessage);
    });
  }

  function deactivate() {
    childIds.forEach((childId) => {
      const activity = children[childId];
      deactivateChild(activity);
      activity.deactivate();
    });
    messageFlows.forEach((flow) => {
      flow.removeListener('message', onMessage);
    });
  }

  function activateChild(activity) {
    activity.on('enter', onChildEnter);
    activity.on('start', onChildStart);
    activity.on('wait', onChildWait);
    activity.on('end', onChildEnd);
    activity.on('cancel', onChildCancel);
    activity.on('leave', onChildLeave);
    activity.on('error', onChildError);
  }

  function deactivateChild(activity) {
    activity.removeListener('enter', onChildEnter);
    activity.removeListener('start', onChildStart);
    activity.removeListener('wait', onChildWait);
    activity.removeListener('cancel', onChildCancel);
    activity.removeListener('end', onChildEnd);
    activity.removeListener('leave', onChildLeave);
    activity.removeListener('error', onChildError);
  }

  function onChildError(err, source) {
    complete(err, source);
  }

  function onChildEnter(activity, activityExecution) {
    pendingActivities.push(activityExecution);
    onChildEvent('enter', activity);
  }

  function onChildStart(activity) {
    onChildEvent('start', activity);
  }

  function onChildCancel(activity) {
    onChildEvent('cancel', activity);
  }

  function onChildWait(activityExecution) {
    debug(`<${id}> wait for <${activityExecution.id}> (${activityExecution.type})`);
    waitingActivities.push(activityExecution);
    onChildEvent('wait', activityExecution);
  }

  function onChildEnd(activity, output) {
    if (activity.terminate) {
      complete(null, activity);
    }

    assignTaskInput(output);

    onChildEvent('end', activity);
  }

  function onChildLeave(activity) {
    pendingActivities = pendingActivities.filter((c) => c.id !== activity.id);

    debug(`<${id}> left <${activity.id}> (${activity.type}), pending activities ${pendingActivities.length}`);

    onChildEvent('leave', activity);

    if (pendingActivities.length === 0) {
      complete(null, activity);
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

  function assignTaskInput(taskOutput) {
    if (!taskOutput) return;
    if (taskOutput.taskInput) {
      variablesAndServices.variables.taskInput = variablesAndServices.variables.taskInput || {};
      return Object.assign(variablesAndServices.variables.taskInput, taskOutput.taskInput);
    }

    Object.assign(variablesAndServices.variables, taskOutput);
  }
};
