'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');
const mapper = require('../mapper');

function IntermediateCatchEvent(activity) {
  Object.assign(this, activity);
}

IntermediateCatchEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = IntermediateCatchEvent;

IntermediateCatchEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

IntermediateCatchEvent.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const environment = scope.environment;
  const eventDefinitions = scope.getEventDefinitions();
  const inbound = scope.inbound;
  const outbound = scope.outbound;

  let boundEventExecution, eventExecutions, events;

  state = state || {
    id,
    type
  };

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    deactivate,
    getApi,
    getState,
    getEvents,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function run(message) {
    boundEventExecution = ActivityExecution(scope, message, environment);
    enter(boundEventExecution);
    executeAllDefinitions();
  }

  function resume() {
    if (!state.entered) return;
    run();
  }

  function stop() {
    deactivate();
  }

  function getState() {
    const result = Object.assign({}, state);

    if (eventExecutions) {
      eventExecutions.forEach(({getState: eventState}) => Object.assign(result, eventState()));
    }

    return result;
  }

  function getEvents() {
    if (events) return events.slice();

    events = eventDefinitions.map((eventDefinition) => {
      eventDefinition.id = eventDefinition.id || id;
      return mapper(eventDefinition.type)(eventDefinition);
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
    boundEventExecution = ActivityExecution(activityApi, null, environment, inboundFlow);
    enter(boundEventExecution);
    executeAllDefinitions();
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    enter();
    discardAllOutbound(rootFlow);
  }

  function enter(executionContext) {
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function completeCallback(err) {
    delete state.entered;

    if (err) return emit('error', err, activityApi, boundEventExecution);

    debug(`<${id}> completed`);
    takeAllOutbound();
  }

  function takeAllOutbound() {
    emit('end', activityApi, boundEventExecution);
    debug(`<${id}> take all outbound (${outbound.length})`);
    if (outbound) outbound.forEach((flow) => flow.take());
    asyncEmit('leave', activityApi, boundEventExecution);
  }

  function discardAllOutbound(rootFlow) {
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
    emit('leave', activityApi, boundEventExecution);
  }

  function executeAllDefinitions() {
    eventExecutions = getEvents().map((event) => {
      return event.init(activityApi, boundEventExecution);
    });

    emit('start', activityApi, boundEventExecution);

    eventExecutions.forEach((event) => event.start(completeCallback.bind(event)));
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
        stop
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
        takeAllOutbound(executionContext);
      }

      function discard() {
        discardAllOutbound(executionContext);
      }

      function stop() {
        executionContext.stop();
        deactivate();
      }
    }
  }
};
