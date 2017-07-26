'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const TaskLoop = require('./task-loop');

module.exports = function TaskActivity(task, execute, state) {
  const id = task.id;
  const type = task.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = task.emit.bind(task);
  const environment = task.environment;
  const inbound = task.inbound;
  const outbound = task.outbound;
  const loop = task.loop;

  let taskLoop;

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

  function run(message, inboundFlow) {
    const executionContext = ActivityExecution(task, message, environment, inboundFlow);
    enter(executionContext);
    const completeFn = completeCallback(executionContext, environment);

    if (loop) return runLoop(executionContext, completeFn);

    emit('start', activityApi, executionContext);
    if (executionContext.isStopped()) {
      return;
    }
    execute(activityApi, executionContext, completeCallback(executionContext));

    return activityApi;
  }

  function runLoop(executionContext, callback) {
    taskLoop = TaskLoop(activityApi, executionContext, loop, (loopExecutionContext) => {
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

  function onInboundTaken(inboundFlow) {
    run(null, inboundFlow);
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    const activityExecution = ActivityExecution(task, null, task.getVariablesAndServices(), inboundFlow, rootFlow);
    enter(activityExecution);
    discardAllOutbound(activityExecution, rootFlow);
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

      complete(executionContext);
    }
  }

  function complete(executionContext) {
    delete state.entered;
    debug(`<${id}> completed`);

    state.taken = true;
    emit('end', activityApi, executionContext);

    if (executionContext.takeAllOutbound()) {
      asyncEmit('leave', activityApi, executionContext);
    }
  }

  function getApi(executionContext) {
    return Api(executionContext);

    function Api() {
      const taskApi = {
        id,
        type,
        form: executionContext.form,
        cancel,
        discard,
        getInput: executionContext.getInput,
        getOutput: executionContext.getOutput,
        getState: getExecutingState,
        stop
      };

      if (executionContext.signal) {
        taskApi.signal = executionContext.signal;
      }
      if (executionContext.iterations.length) {
        taskApi.loop = executionContext.iterations.map((itrExecution) => getApi(itrExecution));
      }

      return taskApi;

      function getExecutingState() {
        return Object.assign(getState(), executionContext.getState());
      }

      function cancel() {
        state.canceled = true;
        debug(`<${id}> cancel`);
        emit('cancel', activityApi, executionContext);
        complete(executionContext);
        executionContext.stop();
      }

      function discard() {
        executionContext.stop();
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
