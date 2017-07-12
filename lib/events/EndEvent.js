'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');

function EndEvent(activity) {
  Object.assign(this, activity);
}

EndEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = EndEvent;

EndEvent.prototype.run = function(message) {
  this.activate().run(message);
};

EndEvent.prototype.execute = function(activityExecution, callback) {
  callback();
};

EndEvent.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const environment = scope.environment;
  const inbound = scope.inbound;
  const terminate = scope.terminate;

  let activityExecution;

  state = state || {
    id,
    type
  };

  const activityApi = {
    id,
    type,
    inbound,
    terminate,
    deactivate,
    discard,
    getState,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function run(message, inboundFlow) {
    activityExecution = ActivityExecution(scope, message, environment, inboundFlow);
    enter(activityExecution);

    emit('start', activityApi, activityExecution);
    scope.execute(activityExecution, completeCallback);
  }

  function resume() {
    if (!state.entered) return;
    run();
  }

  function stop() {
    deactivate();
  }

  function getState() {
    return Object.assign({}, state);
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
  }

  function onInboundTaken(inboundFlow) {
    run(null, inboundFlow);
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    activityExecution = ActivityExecution(scope, null, environment, inboundFlow, rootFlow);
    enter(activityExecution);
    emit('leave', activityApi, activityExecution);
  }

  function enter(executionContext) {
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', scope, executionContext);
  }

  function discard() {
    return completeCallback(null, true);
  }

  function completeCallback(err) {
    delete state.entered;

    if (err) return emit('error', err, scope);
    state.taken = true;
    debug(`<${id}> completed`);
    complete();
  }

  function complete() {
    emit('end', activityApi, activityExecution);
    asyncEmit('leave', activityApi, activityExecution);
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }
};
