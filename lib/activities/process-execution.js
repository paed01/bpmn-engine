'use strict';

const debug = require('debug')('bpmn-engine:process-execution');

module.exports = function ProcessExecution(context, onChildEvent, onComplete) {
  const id = context.id;
  const childIds = Object.keys(context.children);
  const children = context.children;
  const messageFlows = context.messageFlows;

  const waitingActivities = [];
  let pendingActivities = [];

  activate();

  const executionContext = {
    id: id,
    execute: execute,
    signal: signal
  };
  return executionContext;

  function execute(onStart) {
    debug(`<${id}> execute`);
    if (!childIds.length) return complete();

    context.startActivities.forEach((activity) => activity.run());

    if (onStart) onStart(executionContext);
  }

  function signal(childId, input) {
    const childExecutionIdx = waitingActivities.findIndex((a) => a.id === childId);
    if (childExecutionIdx < 0) return;

    debug(`<${id}>`, `signal <${childId}>`);

    const childExecution = waitingActivities.splice(childExecutionIdx, 1)[0];

    childExecution.signal(input);
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

    if (!context.hasAttachedErrorEvent(activity.id)) {
      activity.on('error', onChildError);
    }
  }

  function deactivateChild(activity) {
    activity.removeListener('enter', onChildEnter);
    activity.removeListener('start', onChildStart);
    activity.removeListener('wait', onChildWait);
    activity.removeListener('cancel', onChildCancel);
    activity.removeListener('end', onChildEnd);
    activity.removeListener('leave', onChildLeave);

    if (!context.hasAttachedErrorEvent(activity.id)) {
      activity.removeListener('error', onChildError);
    }
  }

  function onChildError(err, source) {
    complete(err, source);
  }

  function onChildEnter(activity) {
    pendingActivities.push({
      id: activity.id
    });
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

  function onChildEnd(activity) {
    if (activity.terminate) {
      complete(null, activity);
    }
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
};
