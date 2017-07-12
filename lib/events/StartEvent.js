'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');

function StartEvent(activity) {
  Object.assign(this, activity);
  this.isStart = true;
  this.isStartEvent = true;
}

StartEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = StartEvent;

StartEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

StartEvent.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const environment = scope.environment;
  const outbound = scope.outbound;
  const waitForInput = scope.hasInboundMessage || !!scope.form;

  let activityExecution;

  state = state || {
    id,
    type
  };

  const activityApi = {
    id,
    type,
    outbound,
    deactivate,
    execute,
    getApi,
    getState,
    resume,
    run
  };

  activate();

  return activityApi;

  function execute(api, executionContext, callback) {
    if (waitForInput) {
      const postponedExecution = executionContext.postpone((...args) => {
        delete state.waiting;
        callback(...args);
      });
      state.waiting = true;
      return emit('wait', activityApi, postponedExecution);
    }
    return callback();
  }

  function run(message) {
    activityExecution = ActivityExecution(scope, message, environment);
    enter(activityExecution);

    emit('start', activityApi, activityExecution);
    execute(activityApi, activityExecution, completeCallback);

    return activityApi;
  }

  function resume() {
    if (!state.entered) return;
    run();
  }

  function getState() {
    return Object.assign({}, state);
  }

  function activate() {
  }

  function deactivate() {
  }

  function enter(executionContext) {
    delete state.taken;
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function completeCallback(err) {
    delete state.entered;

    if (err) return emit('error', err, scope);

    state.taken = true;

    debug(`<${id}> completed`);
    takeAllOutbound();
  }

  function takeAllOutbound() {
    emit('end', activityApi, activityExecution);
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
