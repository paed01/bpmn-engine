'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');
const TaskLoop = require('./TaskLoop');

function Task(activity) {
  Object.assign(this, activity);
  this.isStart = !this.inbound || this.inbound.length === 0;
}

Task.prototype = Object.create(EventEmitter.prototype);

module.exports = Task;

Task.prototype.run = function(message) {
  this.activate().run(message);
};

Task.prototype.execute = function(activityExecution, callback) {
  callback();
};

Task.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const inbound = scope.inbound;
  const outbound = scope.outbound;
  const loop = scope.loopCharacteristics;

  let activityExecution;

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
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function run(message, inboundFlow) {
    if (loop) return runLoop(message, inboundFlow);
    activityExecution = ActivityExecution(scope, message, scope.getVariablesAndServices(), inboundFlow);
    enter(activityExecution);

    emit('start', activityApi, activityExecution);

    if (activityExecution.isStopped()) {
      return;
    }

    scope.execute(activityExecution, completeCallback);
  }

  function resume() {
    if (!state.entered) return;
    run();
  }

  function runLoop(message, inboundFlow) {
    activityExecution = ActivityExecution(scope, message, scope.getVariablesAndServices(), inboundFlow);
    enter(activityExecution);
    TaskLoop(activityExecution, (loopActivityExecution) => {
      emit('start', activityApi, loopActivityExecution);
    }, (loopActivityExecution, loopIndex, currentResult) => {
      activityExecution.setResult(currentResult);
    }).execute(completeCallback);
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
    activityExecution = ActivityExecution(scope, null, scope.getVariablesAndServices(), inboundFlow, rootFlow);
    enter(activityExecution);
    discardAllOutbound(rootFlow);
  }

  function enter(executionContext) {
    delete state.taken;
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function discard() {
    return discardAllOutbound();
  }

  function completeCallback(err, ...args) {
    if (err) return emit('error', err, activityApi, activityExecution);

    activityExecution.setResult(...args);

    state.taken = true;

    debug(`<${id}> completed`);
    takeAllOutbound();
  }

  function takeAllOutbound() {
    emit('end', activityApi, activityExecution);
    delete state.entered;
    debug(`<${id}> take all outbound (${outbound.length})`);
    if (outbound) outbound.forEach((flow) => flow.take());
    asyncEmit('leave', activityApi, activityExecution);
  }

  function discardAllOutbound(rootFlow) {
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
    emit('leave', activityApi, activityExecution);
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }
};
