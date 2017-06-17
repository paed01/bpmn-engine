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
  this.activate().run(message);
};

IntermediateCatchEvent.prototype.deactivate = function() {
};

IntermediateCatchEvent.prototype.activate = function(state) {
  const debug = Debug('bpmn-engine:intermediatecatchevent');
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const emit = scope.emit.bind(this);
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
    enter();
    boundEventExecution = ActivityExecution(activityApi, null, scope.getVariablesAndServices(), inboundFlow);
    executeAllDefinitions();
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    enter();
    discardAllOutbound(rootFlow);
  }

  function enter() {
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', scope, activityApi);
  }

  function discard() {
    return completeCallback(null, true);
  }

  function completeCallback(err, discardAll) {
    deactivate();
    delete state.entered;

    if (err) return emit('error', err, scope);

    if (discardAll) {
      debug(`<${id}> discard all outbound (${outbound && outbound.length})`);
      return discardAllOutbound(boundEventExecution && boundEventExecution.rootFlow);
    }

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
