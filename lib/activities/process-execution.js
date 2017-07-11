'use strict';

const debug = require('debug')('bpmn-engine:process-execution');
const {BpmnError} = require('./BpmnError');

module.exports = function ProcessExecution(context, emit, onComplete) {
  const id = context.id;
  const type = context.type;
  const environment = context.environment;
  const listener = environment.getListener();
  const childIds = Object.keys(context.children);
  const children = context.children;
  const messageFlows = context.messageFlows;

  const startActivities = [];
  const pendingExecutions = [];
  const caughtErrors = [];
  const activatedChildren = [];
  const waitingActivities = [];

  let start = onStartCallback(), started = false;
  let variablesAndServices = environment.getVariablesAndServices();
  const inputOnStart = assignInput(variablesAndServices);

  const executionContext = {
    id,
    type,
    cancel,
    deactivate,
    execute,
    getChildActivityById,
    getChildState,
    getInput,
    getOutput,
    getState,
    resume,
    signal,
    stop,
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

  function cancel() {
    deactivate();
    emit('cancel', executionContext);
  }

  function stop() {
    deactivate();
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
    const environmentState = environment.getState();
    const result = {
      id,
      type,
      variablesAndServices: JSON.parse(JSON.stringify(environmentState)),
      environment: JSON.parse(JSON.stringify(environmentState)),
      children: getChildStates()
    };

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
      const activityApi = activity.activate(childState, listener);
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

    debug(`<${id}> error thrown from ${source.type} <${source.id}>`);

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

  function onChildCancel(activity, childExecutionContext) {
    onChildEvent('cancel', activity, childExecutionContext);
  }

  function onChildWait(activityApi, childExecutionContext) {
    debug(`<${id}> wait for <${activityApi.id}> (${activityApi.type})`);
    waitingActivities.push(childExecutionContext);
    onChildEvent('wait', activityApi, childExecutionContext);
  }

  function onChildEnd(activityApi, childExecutionContext) {
    assignTaskInput(childExecutionContext);

    if (activityApi.terminate) {
      complete(null, activityApi);
    }

    onChildEvent('end', activityApi, childExecutionContext);
  }

  function onChildLeave(activityApi, childExecutionContext) {
    const childExecutionIdx = pendingExecutions.findIndex((c) => c === childExecutionContext);
    if (childExecutionIdx < 0) return complete(new Error(`<${id}> child ${childExecutionContext.type} <${childExecutionContext.id}> is not running`));

    pendingExecutions.splice(childExecutionIdx, 1);

    debug(`<${id}> left <${childExecutionContext.id}> (${childExecutionContext.type}), pending activities ${pendingExecutions.length}`);

    onChildEvent('leave', activityApi, childExecutionContext);

    if (pendingExecutions.length === 0) {
      complete(null, activityApi);
    }
  }

  function onMessage(message, source, childExecutionContext) {
    debug(`<${id}> message sent via <${source.id}> (${source.type})`);
    emit('message', message, source, executionContext);
    onChildEvent('message', source, childExecutionContext, message);
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
      environment.assignTaskInput(childExecutionContext.id, taskOutput);
    } else {
      environment.assignResult(taskOutput);
    }
  }

  function onChildEvent(eventName, source, childExecutionContext, ...args) {
    if (!listener) return;

    const sourceApi = source.getApi ? source.getApi(childExecutionContext) : source;
    listener.emit(`${eventName}-${source.id}`, sourceApi, executionContext, ...args);
    listener.emit(eventName, sourceApi, executionContext, ...args);
  }
};
