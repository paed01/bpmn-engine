'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');
const mapper = require('../mapper');

function BoundaryEvent(activity) {
  Object.assign(this, activity);
  this.cancelActivity = activity.getEventDefinitions().some(({cancelActivity}) => cancelActivity);
}

BoundaryEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = BoundaryEvent;

BoundaryEvent.prototype.run = function(message) {
  this.activate().run(message);
};

BoundaryEvent.prototype.deactivate = function() {
};

BoundaryEvent.prototype.activate = function(state) {
  const debug = Debug('bpmn-engine:boundaryevent');
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const emit = scope.emit.bind(this);
  const attachedTo = scope.getAttachedToActivity();
  const eventDefinitions = scope.getEventDefinitions();
  const inbound = scope.inbound;
  const outbound = scope.outbound;

  let boundEventExecution, eventExecutions, events;

  state = state || {
    id,
    type,
    attachedToId: attachedTo.id
  };

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    deactivate,
    discard,
    getState,
    getEvents,
    run,
    stop
  };

  activate();

  return activityApi;

  function run(message) {
    boundEventExecution = ActivityExecution(scope, message, scope.getVariablesAndServices());
    enter();
    executeAllDefinitions();
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

  function deactivate() {
    attachedTo.removeListener('enter', onAttachedEnter);
    attachedTo.removeListener('start', onAttachedStart);
    attachedTo.removeListener('end', onAttachedEnd);
    attachedTo.removeListener('leave', onAttachedLeave);
    if (eventExecutions) {
      eventExecutions.forEach((boundaryEventExecution) => {
        boundaryEventExecution.deactivate();
      });
    }
  }

  function activate() {
    attachedTo.on('enter', onAttachedEnter);
    attachedTo.on('start', onAttachedStart);
    attachedTo.on('end', onAttachedEnd);
    attachedTo.on('leave', onAttachedLeave);
  }

  function onAttachedEnter() {
    enter();
  }

  function onAttachedLeave() {
    completeCallback(null, true);
  }

  function onAttachedStart(attachedContext) {
    boundEventExecution = ActivityExecution(activityApi, null, attachedContext.getContextInput(), attachedContext.inboundFlow, attachedContext.rootFlow);
    executeAllDefinitions();
  }

  function onAttachedEnd(output, executionContext) {
    completeCallback(null, executionContext, true);
  }

  function enter() {
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', scope, activityApi);
  }

  function discard() {
    return completeCallback(null, true);
  }

  function completeCallback(err, discardAll, cancelActivity) {
    deactivate();
    delete state.entered;

    if (err) return emit('error', err, scope);

    if (discardAll) {
      debug(`<${id}> discard all outbound (${outbound && outbound.length})`);
      return discardAllOutbound(boundEventExecution && boundEventExecution.rootFlow);
    }

    debug(`<${id}> completed`);
    takeAllOutbound(cancelActivity);
  }

  function takeAllOutbound(cancelActivity) {
    if (cancelActivity) attachedTo.discard();
    emit('end', activityApi, boundEventExecution);

    asyncEmit('leave', activityApi, boundEventExecution);
    if (outbound) outbound.forEach((flow) => flow.take());
  }

  function discardAllOutbound(rootFlow) {
    emit('leave', activityApi, boundEventExecution);
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
  }

  function executeAllDefinitions() {
    eventExecutions = getEvents().map((event) => {
      return event.init(boundEventExecution, getState());
    });

    emit('start', activityApi);

    eventExecutions.forEach((event) => event.start(completeCallback.bind(event)));
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }
};
