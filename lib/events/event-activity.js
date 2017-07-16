'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const mapper = require('../mapper');

module.exports = function EventActivity(event, execute, state) {
  const id = event.id;
  const type = event.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = event.emit.bind(event);
  const environment = event.environment;
  const eventDefinitions = event.getEventDefinitions();
  const inbound = event.inbound;
  const outbound = event.outbound;
  const pendingDefinitionExecutions = [];

  let eventActivityExecution, eventExecutions, events, started;

  state = Object.assign(state, {
    id,
    type
  });

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

  function run(message, inboundFlow) {
    eventActivityExecution = ActivityExecution(event, message, environment, inboundFlow);
    enter(eventActivityExecution);

    const eventDefinitionActivities = activateEventDefinitions(eventActivityExecution);

    execute(activityApi, eventActivityExecution, eventDefinitionActivities, completeCallback);
  }

  function activateEventDefinitions(executionContext) {
    const eventDefinitionActivities = getEvents().map((ed) => ed.activate(activityApi, executionContext, definitionEmitter));
    return eventDefinitionActivities;

    function definitionEmitter(eventName, ...args) {
      switch (eventName) {
        case 'enter':
          onDefinitionEnter(...args);
          break;
        case 'start':
          onDefinitionStart(...args);
          break;
        case 'terminate':
          onDefinitionTerminate(...args);
          break;
        case 'leave':
          onDefinitionLeave(...args);
          break;
      }
    }

    function onDefinitionEnter(definitionApi) {
      pendingDefinitionExecutions.push(definitionApi);
    }

    function onDefinitionStart() {
      start(executionContext);
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

  function resume() {
    if (!state.entered) return;
    run();
  }

  function enter(executionContext) {
    delete state.taken;
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
    return result;
  }

  function getEvents() {
    if (events) return events.slice();

    events = eventDefinitions.map((eventDefinition) => {
      eventDefinition.id = eventDefinition.id || id;
      return mapper(eventDefinition.type)(eventDefinition, state, event);
    });

    return events.slice();
  }

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

  function onInboundTaken(inboundFlow) {
    run(null, inboundFlow);
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    eventActivityExecution = ActivityExecution(event, null, environment, inboundFlow, rootFlow);
    enter(eventActivityExecution);
    discardAllOutbound(rootFlow);
  }

  function completeCallback(err) {
    if (!started) start(eventActivityExecution);
    delete state.entered;

    if (err) return emit('error', err, activityApi, eventActivityExecution);

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
        type,
        form: executionContext.form,
        cancel,
        discard,
        getInput: executionContext.getInput,
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
