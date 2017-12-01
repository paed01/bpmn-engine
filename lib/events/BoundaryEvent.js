'use strict';

const ActivityExecution = require('../activities/activity-execution');
const ActivityIO = require('../io/ActivityIo');
const Debug = require('debug');
const EventDefinition = require('../eventDefinitions/EventDefinition');
const {EventEmitter} = require('events');

module.exports = function BoundaryEvent(activityElement, parentContext) {
  const {id, $type: type, eventDefinitions} = activityElement;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  const {environment, getOutboundSequenceFlows, getAttachedToActivity} = parentContext;
  let attachedTo;
  let cancelActivity = activityElement.cancelActivity;
  if (cancelActivity === undefined) cancelActivity = true;

  const outbound = getOutboundSequenceFlows(id);
  const io = ActivityIO(activityElement, parentContext);

  let loadedEventDefinitions, attachedToListener, resumedState;

  const activityApi = Object.assign(new EventEmitter(), {
    id,
    type,
    cancelActivity,
    io,
    outbound,
    getApi,
    getState,
    getEventDefinitions,
    activate: activateActivity,
    deactivate: deactivateActivity,
    discard: discardActivity,
    resume: resumeActivity,
    run,
    stop: deactivateActivity
  });

  function emit(...args) {
    activityApi.emit(...args);
  }

  return activityApi;

  function run() {}

  function resumeActivity(state) {
    resumedState = state;
  }

  function discardActivity() {
    if (attachedToListener) return attachedToListener.discard();
  }

  function getState() {
    const result = {
      id,
      type,
      attachedToId: getAttachedTo().id
    };

    if (attachedToListener) Object.assign(result, attachedToListener.getListenerState());

    return result;
  }

  function activateActivity() {
    if (attachedToListener) return attachedToListener;
    const attachedToActivity = getAttachedTo();
    attachedToActivity.on('enter', onAttachedToEnter);
    attachedToActivity.on('end', onAttachedToEnd);
    attachedToActivity.on('leave', onAttachedToLeave);
    return activityApi;
  }

  function deactivateActivity() {
    const attachedToActivity = getAttachedTo();
    attachedToActivity.removeListener('enter', onAttachedToEnter);
    attachedToActivity.removeListener('leave', onAttachedToLeave);
    if (attachedToListener) attachedToListener.stop();
  }

  function onAttachedToEnter(...args) {
    attachedToListener = AttachedToListener(...args);
    if (resumedState) {
      attachedToListener.resume(resumedState);
      resumedState = undefined;
    }
    attachedToListener.enter();
    return attachedToListener;
  }

  function onAttachedToEnd(attachedToApi, attachedToExecution) {
    if (attachedToExecution.isLoopContext) return;
    onAttachedToLeave();
  }

  function onAttachedToLeave() {
    if (attachedToListener) {
      attachedToListener.complete();
      attachedToListener = undefined;
    }
  }

  function getEventDefinitions() {
    if (loadedEventDefinitions) return loadedEventDefinitions;

    if (!eventDefinitions) {
      loadedEventDefinitions = [];
    } else {
      loadedEventDefinitions = eventDefinitions.reduce((result, ed) => {
        const eventDefinition = EventDefinition(activityElement, ed, parentContext);
        if (eventDefinition) result.push(eventDefinition);
        return result;
      }, []);
    }

    return loadedEventDefinitions;
  }

  function getAttachedTo() {
    if (attachedTo) return attachedTo;
    attachedTo = getAttachedToActivity(id);
    return attachedTo;
  }

  function AttachedToListener(attachedToApi, attachedToExecution) {
    let activityExecution, activeDefinitions;
    const attachedToActivity = getAttachedTo();
    const {id: attachedToId} = attachedToActivity;
    let entered, taken, deactivated;

    attachedToActivity.once('start', onAttachedStart);

    return {
      discard,
      enter,
      resume,
      complete,
      deactivate,
      getListenerState,
      stop
    };

    function complete() {
      if (!entered) return;
      discard();
    }

    function enter() {
      entered = true;
      debug(`<${id}> entered`);
      emit('enter', activityApi, getActivityExecution());
    }

    function resume(state) {
      resumeEventDefinitions(state);
    }

    function onAttachedStart(...args) {
      debug(`<${id}> listen to <${attachedToId}>`);

      activate();

      getActivateEventDefinitions().forEach((ed) => ed.onStart(...args));
    }

    function onAttachedError(err, ...args) {
      getActivateEventDefinitions().forEach((ed) => ed.onError(err, ...args));
    }

    function stop() {
      deactivate();
      if (activeDefinitions) activeDefinitions.forEach((ed) => ed.stop());
    }

    function activate() {
      attachedToActivity.prependListener('error', onAttachedError);
    }

    function deactivate() {
      if (deactivated) return;
      deactivated = true;
      attachedToActivity.removeListener('start', onAttachedStart);
      attachedToActivity.removeListener('error', onAttachedError);
    }

    function completeEventDefinition() {
      if (!taken) return discard();

      stop();
      entered = undefined;

      const execution = getActivityExecution();
      debug(`<${id}> take all outbound`, cancelActivity ? `and cancel <${attachedToId}>` : '');
      execution.takeAllOutbound();
      emit('end', activityApi, execution);
      if (cancelActivity) discardAttachedTo();
      return asyncEmit('leave', activityApi, execution);
    }

    function discard() {
      stop();
      entered = undefined;

      const execution = getActivityExecution();
      debug(`<${id}> discard all outbound`);
      execution.discardAllOutbound();
      return emit('leave', activityApi, execution);
    }

    function discardAttachedTo() {
      debug(`<${id}> discard <${attachedToId}>`);
      attachedToApi.getApi(attachedToExecution).discard();
    }

    function getListenerState() {
      return getActivateEventDefinitions().reduce((result, ed) => {
        Object.assign(result, ed.getState());
        return result;
      }, {
        entered,
        taken
      });
    }

    function getActivityExecution() {
      if (activityExecution) return activityExecution;
      activityExecution = ActivityExecution(activityApi, null, environment);
      return activityExecution;
    }

    function getActivateEventDefinitions() {
      if (activeDefinitions) return activeDefinitions;
      activeDefinitions = getEventDefinitions().map((ed) => ed.activate(activityApi, getActivityExecution(), eventDefinitionEmitter(ed)));
      return activeDefinitions;
    }

    function resumeEventDefinitions(state) {
      if (activeDefinitions) return activeDefinitions;
      activeDefinitions = getEventDefinitions().map((ed) => ed.resume(state, activityApi, getActivityExecution(), eventDefinitionEmitter(ed)));
      return activeDefinitions;
    }

    function eventDefinitionEmitter() {
      return function emitter(eventName, ...args) {
        switch (eventName) {
          case 'start':
            emit(eventName, ...args);
            break;
          case 'catch':
            taken = true;
            emit(eventName, ...args);
            completeEventDefinition();
            break;
          case 'end':
            taken = true;
            completeEventDefinition();
            break;
        }
      };
    }
  }

  function getApi(activityExecution) {
    return Api();

    function Api() {
      const api = {
        id,
        type,
        form: activityExecution.form,
        cancel,
        discard: discardActivity,
        getInput: activityExecution.getInput,
        getOutput: activityExecution.getOutput,
        getState: getExecutingState,
        signal: activityExecution.signal,
        stop: activityApi.stop
      };

      return api;

      function getExecutingState() {
        return Object.assign(activityExecution.getState(), getState());
      }

      function cancel() {
        emit('cancel', activityApi, activityExecution);
        discardActivity();
      }
    }
  }

  function asyncEmit(eventName, ...args) {
    setImmediate(emit, eventName, ...args);
  }
};
