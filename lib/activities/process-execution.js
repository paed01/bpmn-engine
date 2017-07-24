'use strict';

const debug = require('debug')('bpmn-engine:process-execution');
const {BpmnError} = require('./BpmnError');

module.exports = function ProcessExecution(parentApi, context, emit) {
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
  const activityApis = {};
  const waitingActivities = [];

  let entered = false, onComplete, started = false;
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
    getPendingActivities,
    getInput,
    getOutput,
    getState,
    resume,
    sendMessage,
    signal,
    stop,
  };

  return executionContext;

  function execute(callback) {
    activate();
    debug(`<${id}> execute`);
    onComplete = onCompleteCallback(callback);
    if (!childIds.length) return complete();
    startActivities.forEach((activity) => activity.run());
  }

  function resume(state, callback) {
    onComplete = onCompleteCallback(callback);
    context.resume(state);

    activate(state);
    debug(`<${id}> resume`);
    if (!childIds.length) return complete();

    resumeChildren(state);
  }

  function cancel() {
    deactivate();
    emitter('cancel', parentApi, executionContext);
  }

  function stop() {
    debug(`<${id}> stop (stop child executions ${pendingExecutions.length})`);
    pendingExecutions.forEach((pe) => pe.stop());
    deactivate();
  }

  function enter() {
    if (entered) throw new Error('Already entered!');
    entered = true;
    emitter('enter', parentApi, executionContext);
  }

  function start() {
    started = true;
    emitter('start', parentApi, executionContext);
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
    const childExecution = pendingExecutions.find((a) => a.id === childId);
    if (!childExecution || !childExecution.signal) return;

    debug(`<${id}> signal <${childId}>`);
    childExecution.signal(input);
    return true;
  }

  function getState() {
    const environmentState = environment.getState();
    const result = {
      id,
      type,
      entered: started,
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
    activatedChildren.forEach((activityApi) => {
      const childExecutions = getPendingChildExecutions(activityApi.id);
      if (childExecutions.length) {
        childStates.push(...childExecutions.map((ec) => activityApi.getApi(ec).getState()));
      } else {
        childStates.push(activityApi.getState());
      }
    });
    return childStates;
  }

  function getPendingActivities() {
    return pendingExecutions.map((pe) => {
      return getChildActivityApi(pe.activityId).getApi(pe);
    });
  }

  function getPendingChildExecutions(childId) {
    return pendingExecutions.filter(({activityId}) => childId === activityId);
  }

  function getChildActivityApi(childId) {
    return activatedChildren.find(({id: apiId}) => childId === apiId);
  }

  function getInput() {
    return inputOnStart;
  }

  function getOutput() {
    return variablesAndServices;
  }

  function getChildActivityById(childId) {
    return children[childId];
  }

  function onCompleteCallback(callback) {
    return function(err, source, childExecutionContext) {
      if (callback) {
        deactivate();
        return callback(err, source, childExecutionContext);
      }
      complete(err, source, childExecutionContext);
    };
  }

  function complete(err, source) {
    deactivate();
    if (err) return emit('error', err, source, executionContext);
    started = false;

    emitter('end', parentApi, executionContext);

    if (onComplete) onComplete(err, source, executionContext);
  }

  function activate(state) {
    childIds.forEach((childId) => {
      const activity = children[childId];
      const childState = state && state.children.find((s) => s.id === childId);

      onChildEvents(activity);
      const activityApi = activity.activate(childState, listener);
      if (activity.isStart) startActivities.push(activityApi);
      activityApis[childId] = activityApi;
      activatedChildren.push(activityApi);
    });

    messageFlows.forEach((flow) => {
      flow.on('message', onMessage);
    });

    if (!entered) enter();
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
    activity.on('terminate', onChildTerminate);
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
    activity.removeListener('terminate', onChildTerminate);
    activity.removeListener('leave', onChildLeave);
    activity.removeListener('error', onChildError);
    activity.removeListener('catch', onChildCatch);
  }

  function onChildError(err, source) {
    if (caughtErrors.includes(err)) return;
    if (err instanceof BpmnError) {
      debug(`<${id}> error thrown from ${source.type} <${source.id}>`);
    }

    onComplete(err, source);
  }

  function onChildCatch(err) {
    if (err instanceof BpmnError) {
      debug(`<${id}> error caught from ${err.source.type} <${err.source.id}>`);
      return caughtErrors.push(err.inner);
    }

    caughtErrors.push(err);
  }

  function onChildEnter(activityApi, childExecutionContext) {
    if (!started) start();

    pendingExecutions.push(childExecutionContext);

    onChildEvent('enter', activityApi, childExecutionContext);
  }

  function onChildStart(activityApi, childExecutionContext) {
    onChildEvent('start', activityApi, childExecutionContext);
  }

  function onChildCancel(activityApi, childExecutionContext) {
    onChildEvent('cancel', activityApi, childExecutionContext);
  }

  function onChildWait(activityApi, childExecutionContext) {
    debug(`<${id}> wait for <${activityApi.id}> (${activityApi.type})`);
    waitingActivities.push(childExecutionContext);
    onChildEvent('wait', activityApi, childExecutionContext);
  }

  function onChildEnd(activityApi, childExecutionContext) {
    assignTaskInput(childExecutionContext);
    onChildEvent('end', activityApi, childExecutionContext);
  }

  function onChildTerminate(activityApi, childExecutionContext) {
    assignTaskInput(childExecutionContext);
    debug(`<${id}> execution terminated by <${childExecutionContext.id}> (${childExecutionContext.type})`);
    complete(null, activityApi);
    onChildEvent('terminate', activityApi, childExecutionContext);
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

  function onMessage(message) {
    debug(`<${id}> message sent via <${message.via.id}> (${message.via.type})`);
    emit('message', message, executionContext);
    onChildEvent('message', message);
  }

  function sendMessage({via, message}) {
    debug(`<${id}> got message to <${via.targetId}>`);
    const childExecution = pendingExecutions.find((c) => c.id === via.targetId);
    childExecution.signal(message);
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

  function emitter(eventName, ...args) {
    emit(eventName, ...args);
    if (!listener) return;
    listener.emit(`${eventName}-${id}`, executionContext);
    listener.emit(eventName, executionContext);
  }

  function onChildEvent(eventName, source, childExecutionContext, ...args) {
    if (!listener) return;
    if (eventName === 'message') return listener.emit('message', source, ...args);

    const sourceApi = source.getApi ? source.getApi(childExecutionContext) : source;
    listener.emit(`${eventName}-${source.id}`, sourceApi, executionContext, ...args);
    listener.emit(eventName, sourceApi, executionContext, ...args);
  }
};
