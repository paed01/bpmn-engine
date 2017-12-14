'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');

module.exports = function EventActivity(eventApi, execute, state) {
  const {id, type, environment, inbound, outbound, getEventDefinitions} = eventApi;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = (...args) => eventApi.emit(...args);
  const eventDefinitions = eventApi.getEventDefinitions();

  let pendingDefinitionExecutions;

  state = state || eventApi.getState();
  let eventActivityExecution, eventExecutions, started;

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    deactivate,
    execute,
    getApi,
    getState,
    getEvents,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function activate() {
    inbound.forEach((flow) => {
      flow.on('taken', onInboundTaken);
      flow.on('discarded', onInboundDiscarded);
    });
  }

  function deactivate() {
    inbound.forEach((flow) => {
      flow.removeListener('taken', onInboundTaken);
      flow.removeListener('discarded', onInboundDiscarded);
    });

    if (eventExecutions) {
      eventExecutions.forEach((boundaryEventExecution) => {
        boundaryEventExecution.deactivate();
      });
    }
  }

  function run(message, inboundFlow) {
    eventActivityExecution = ActivityExecution(eventApi, message, environment, inboundFlow);
    enter(eventActivityExecution);

    if (eventActivityExecution.isStopped()) {
      return;
    }

    const eventDefinitionActivities = getActivateEventDefinitions(eventActivityExecution);
    execute(activityApi, eventActivityExecution, eventDefinitionActivities, completeCallback);
  }

  function resume() {
    eventActivityExecution = ActivityExecution(eventApi, null, environment).resume(state);

    if (!state.entered) return;

    enter(eventActivityExecution);

    if (eventActivityExecution.isStopped()) {
      return;
    }

    const eventDefinitionActivities = getActivateEventDefinitions(eventActivityExecution);

    execute(activityApi, eventActivityExecution, eventDefinitionActivities, completeCallback);
  }

  function getActivateEventDefinitions(executionContext) {
    if (pendingDefinitionExecutions) return pendingDefinitionExecutions;
    pendingDefinitionExecutions = getEventDefinitions().map((ed) => ed.activate(activityApi, executionContext, definitionEmitter));
    return pendingDefinitionExecutions;

    function definitionEmitter(eventName, ...args) {
      switch (eventName) {
        case 'error':
          onDefinitionError(...args);
          break;
        case 'start':
          onDefinitionStart(...args);
          break;
        case 'wait':
          onDefinitionWait(...args);
          break;
        case 'end':
          onDefinitionEnd(...args);
          break;
        case 'terminate':
          onDefinitionTerminate(...args);
          break;
        case 'leave':
          onDefinitionLeave(...args);
          break;
      }
    }

    function onDefinitionError(err) {
      completeCallback(err);
    }

    function onDefinitionStart() {
      start(executionContext);
    }

    function onDefinitionEnd() {
      completeCallback();
    }

    function onDefinitionWait() {
      executionContext.postpone(completeCallback);
      emit('wait', activityApi, eventActivityExecution);
    }

    function onDefinitionTerminate() {
      completeCallback();
      emit('terminate', activityApi, eventActivityExecution);
    }

    function onDefinitionLeave(definitionApi) {
      const idx = pendingDefinitionExecutions.indexOf(definitionApi);
      if (idx < 0) return completeCallback(new Error(`<${id}> ${definitionApi.type} is not running`));
      pendingDefinitionExecutions.splice(idx, 1);

      if (pendingDefinitionExecutions.length === 0) {
        return completeCallback();
      }
    }
  }

  function enter(executionContext) {
    if (state.taken) state.taken = undefined;
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function start(executionContext) {
    started = true;
    emit('start', activityApi, executionContext);
  }

  function stop() {
    eventActivityExecution.stop();
    deactivate();
  }

  function getState() {
    const result = Object.assign({}, state);

    if (pendingDefinitionExecutions) {
      pendingDefinitionExecutions.forEach((ed) => {
        Object.assign(result, ed.getState());
      });
    }

    return result;
  }

  function getEvents() {
    if (eventDefinitions) return eventDefinitions.slice();
  }

  function onInboundTaken(inboundFlow) {
    run(null, inboundFlow);
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    eventActivityExecution = ActivityExecution(eventApi, null, environment, inboundFlow, rootFlow);
    enter(eventActivityExecution);
    discardAllOutbound(rootFlow);
  }

  function completeCallback(err, ...args) {
    if (!started) start(eventActivityExecution);
    state.entered = undefined;

    if (err) return emit('error', err, activityApi, eventActivityExecution);
    eventActivityExecution.setResult(...args);

    complete(eventActivityExecution);
  }

  function complete(executionContext) {
    debug(`<${id}> completed`);

    state.taken = true;
    emit('end', activityApi, executionContext);

    if (executionContext.takeAllOutbound()) {
      asyncEmit('leave', activityApi, executionContext);
    }
  }

  function discardAllOutbound(rootFlow) {
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
    state.entered = undefined;
    emit('leave', activityApi, eventActivityExecution);
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }

  function getApi(executionContext) {
    return Api(executionContext);

    function Api() {
      const api = {
        id,
        executionId: executionContext.executionId,
        type,
        form: executionContext.getForm(),
        cancel,
        discard,
        getInput: executionContext.getInput,
        getOutput: executionContext.getOutput,
        getState: getExecutingState,
        stop: apiStop
      };
      if (executionContext.signal) {
        api.signal = executionContext.signal;
      }

      return api;

      function getExecutingState() {
        return Object.assign(executionContext.getState(), getState());
      }

      function cancel() {
        state.canceled = true;
        emit('cancel', activityApi, executionContext);
        complete(executionContext);
      }

      function discard() {
        discardAllOutbound(executionContext);
      }

      function apiStop() {
        executionContext.stop();
        deactivate();
      }
    }
  }
};
