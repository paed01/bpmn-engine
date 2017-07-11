'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');
const ProcessExecution = require('../activities/process-execution');
const TaskLoop = require('./task-loop');

function SubProcess(activity) {
  Object.assign(this, activity);
  this.isSubProcess = true;
  this.isStart = !this.inbound || this.inbound.length === 0;
  this.context = activity.getSubContext(activity.id);
}

SubProcess.prototype = Object.create(EventEmitter.prototype);

module.exports = SubProcess;

SubProcess.prototype.getChildActivityById = function(childId) {
  return this.context.getChildActivityById(childId);
};

SubProcess.prototype.run = function(message) {
  return this.activate().run(message);
};

SubProcess.prototype.activate = function(state) {
  const task = this;
  const id = task.id;
  const type = task.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const environment = task.environment;
  const emit = task.emit.bind(task);
  const inbound = task.inbound;
  const outbound = task.outbound;
  const loop = task.loop;
  const context = task.context;

  state = Object.assign(state || {}, {
    id,
    type
  });

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    loop,
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
    const subEnvironment = executionContext.environment.clone(executionContext.getInput());
    const subContext = context.getSubContext(id, subEnvironment);
    const execution = ProcessExecution(subContext, emitter, callback);

    function emitter(eventName) {
      if (eventName === 'cancel') {
        debug(`<${id}> cancelled`);
        state.cancelled = true;
        deactivate();
        takeAllOutbound(executionContext);
      }
    }

    execution.execute();
  }

  function run(message, inboundFlow) {
    const executionContext = ActivityExecution(task, message, environment, inboundFlow);
    enter(executionContext);
    const complete = completeCallback(executionContext, environment);

    if (loop) return runLoop(executionContext, complete);

    emit('start', activityApi, executionContext);
    if (executionContext.isStopped()) {
      return;
    }
    execute(activityApi, executionContext, complete);

    return activityApi;
  }

  function runLoop(executionContext, callback) {
    TaskLoop(activityApi, executionContext, loop, (loopExecutionContext) => {
      emit('start', activityApi, loopExecutionContext);
    }, (err) => {
      if (err) emit('error', err, activityApi, executionContext);
    }).execute(callback);
  }

  function enter(executionContext) {
    delete state.taken;
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function resume() {
    if (!state.entered) return;
    run();
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
    const activityExecution = ActivityExecution(task, null, task.getVariablesAndServices(), inboundFlow, rootFlow);
    enter(activityExecution);
    discardAllOutbound(activityExecution, rootFlow);
  }

  function takeAllOutbound(executionContext) {
    emit('end', activityApi, executionContext);
    debug(`<${id}> take all outbound (${outbound.length})`);
    if (outbound) outbound.forEach((flow) => flow.take());
    asyncEmit('leave', activityApi, executionContext);
  }

  function discardAllOutbound(executionContext, rootFlow) {
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
    emit('leave', activityApi, executionContext);
  }

  function completeCallback(executionContext) {
    return callback;

    function callback(err, ...args) {
      delete state.entered;
      if (err) return emit('error', err, activityApi, executionContext);
      executionContext.setResult(...args);

      state.taken = true;

      debug(`<${id}> completed`);
      takeAllOutbound(executionContext);
    }
  }

  function getApi(executionContext) {
    return Api(executionContext);

    function Api() {
      return {
        id,
        type,
        form: executionContext.form,
        cancel,
        discard,
        getInput: executionContext.getInput,
        getState: getExecutingState,
        signal: executionContext.signal,
        stop
      };

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

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }
};

