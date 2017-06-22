'use strict';

const debug = require('debug')('bpmn-engine:process-execution');
const {BpmnError} = require('./BpmnError');

module.exports = function ProcessExecution(context, onChildEvent, onComplete) {
  const id = context.id;
  const type = context.type;
  const childIds = Object.keys(context.children);
  const children = context.children;
  const messageFlows = context.messageFlows;

  const startActivities = context.startActivities;

  const caughtErrors = [], activatedChildren = [], waitingActivities = [];
  let start = onStartCallback(), started = false;
  let pendingActivities = [];
  let variablesAndServices = context.getVariablesAndServices();
  const inputOnStart = assignInput(variablesAndServices);

  const executionContext = {
    id,
    type,
    applyState,
    deactivate,
    execute,
    getChildActivityById,
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

    applyState(state);
  }

  function onStartCallback(callback) {
    return function() {
      started = true;
      if (callback) callback(executionContext);
    };
  }

  function applyState(state) {
    variablesAndServices = context.getVariablesAndServices();

    const resumeStates = state.children.reduce((result, childState) => {
      if (childState.entered && childState.pendingJoin) {
        // Pending joins
        result.pre.push(childState);
      } else if (childState.attachedToId) {
        // Boundary events
        result.pre.push(childState);
      } else {
        result.post.push(childState);
      }

      return result;
    }, {
      pre: [],
      post: []
    });

    resumeStates.pre.forEach((childState) => {
      if (children[childState.id].resume) children[childState.id].resume(childState);
    });
    resumeStates.post.forEach((childState) => {
      children[childState.id].resume(childState);
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

  function activate(state) {
    childIds.forEach((childId) => {
      const activity = children[childId];

      const childState = state && state.children.find((s) => s.id === childId);

      onChildEvents(activity);
      activatedChildren.push(activity.activate(childState));
    });

    messageFlows.forEach((flow) => {
      flow.on('message', onMessage);
    });
  }

  function deactivate() {
    pendingActivities.forEach((activity) => activity.stop());

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
    if (err instanceof BpmnError) {
      return caughtErrors.push(err.source);
    }

    caughtErrors.push(err);
  }

  function onChildEnter(activity, activityExecution) {
    if (!started) start();

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
