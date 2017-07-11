'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');
const mapper = require('../mapper');

function BoundaryEvent(activity) {
  Object.assign(this, activity);
  this.isStart = false;
  this.cancelActivity = activity.getEventDefinitions().some(({cancelActivity}) => cancelActivity);
}

BoundaryEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = BoundaryEvent;

BoundaryEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

BoundaryEvent.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const attachedTo = scope.getAttachedToActivity();
  const eventDefinitions = scope.getEventDefinitions();
  const inbound = scope.inbound;
  const outbound = scope.outbound;

  let attachedListener, eventExecutions, events;

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
    attachedTo,
    deactivate,
    discard,
    getEvents,
    getState,
    run,
    resume,
    stop
  };

  activate();

  return activityApi;

  function activate() {
    attachedTo.on('enter', onAttachedEnter);
  }

  function deactivate() {
    attachedTo.removeListener('enter', onAttachedEnter);
    if (attachedListener) attachedListener.unattach();
  }

  function onAttachedEnter(attachedApi, attachedExecution) {
    attachedListener = AttachedListener(attachedApi, attachedExecution);
  }

  function stop() {
    deactivate();
  }

  function run() {}

  function resume() {}

  function complete(boundEventExecution) {
    delete state.entered;
    state.taken = true;
    emit('end', activityApi, boundEventExecution);
    if (outbound) {
      debug(`<${id}> take all outbound (${outbound && outbound.length})`);
      outbound.forEach((flow) => flow.take());
    }
    asyncEmit('leave', activityApi, boundEventExecution);
  }

  function getState() {
    const result = Object.assign({}, state);

    getEvents().forEach((e) => Object.assign(result, e.getState()));

    if (attachedListener) {
      Object.assign(result, attachedListener.getEventsState());
    }

    return result;
  }

  function getEvents() {
    if (events) return events.slice();

    events = eventDefinitions.map((eventDefinition) => {
      eventDefinition.id = eventDefinition.id || id;
      return mapper(eventDefinition.type)(eventDefinition, state, attachedTo, emit);
    });

    return events.slice();
  }

  function discard() {
    if (attachedListener) attachedListener.unattach();
    discardAllOutbound(null, attachedListener.executionContext);
  }

  function discardAllOutbound(rootFlow, executionContext) {
    delete state.entered;
    emit('leave', activityApi, executionContext);
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }

  function AttachedListener(attachedApi, attachedExecution) {
    const boundEventExecution = ActivityExecution(activityApi, null, attachedExecution.getContextInput());

    enter();
    attach();

    return {
      executionContext: boundEventExecution,
      getEventsState,
      unattach
    };

    function enter() {
      delete state.taken;
      state.entered = true;
      debug(`<${id}> enter`);
      emit('enter', activityApi, boundEventExecution);
    }

    function attach() {
      attachedTo.once('start', onAttachedStart);
      attachedTo.on('end', onAttachedEnd);
      attachedTo.on('leave', onAttachedLeave);
    }

    function unattach() {
      attachedTo.removeListener('start', onAttachedStart);
      attachedTo.removeListener('end', onAttachedEnd);
      attachedTo.removeListener('leave', onAttachedLeave);
      if (eventExecutions) {
        eventExecutions.forEach((eventExecution) => {
          eventExecution.deactivate();
        });
      }
    }

    function getEventsState() {
      const result = {};
      if (!eventExecutions) return result;
      eventExecutions.forEach(({getState: eventState}) => Object.assign(result, eventState()));
      return result;
    }

    function onAttachedStart(startApi) {
      attachedApi = startApi;
      executeAllDefinitions(boundEventExecution);
    }

    function onAttachedEnd() {
      unattach();
      discardAllOutbound(attachedExecution.rootFlow, boundEventExecution);
    }

    function onAttachedLeave() {
      unattach();
      discardAllOutbound(attachedExecution.rootFlow, boundEventExecution);
    }

    function executeAllDefinitions() {
      eventExecutions = getEvents().map((event) => {
        return event.init(activityApi, boundEventExecution);
      });

      emit('start', activityApi, boundEventExecution);

      eventExecutions.forEach((event) => event.start(completeCallback.bind(event)));
    }

    function completeCallback(err, cancelActivity) {
      unattach();
      if (err) return emit('error', err, scope);
      state.taken = true;
      if (cancelActivity) attachedApi.getApi(attachedExecution).discard();
      debug(`<${id}> completed`);
      complete(boundEventExecution);
    }
  }
};
