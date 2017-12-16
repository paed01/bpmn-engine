'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const ProcessExecution = require('../process/Execution');
const TaskExecutionLoop = require('./TaskExecutionLoop');

module.exports = SubProcess;

function SubProcess(activity, parentContext) {
  const {id, type, inbound, outbound, loop} = activity;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = (...args) => activity.emit(...args);
  const {getSubContext} = parentContext;

  const context = getSubContext(activity.id);
  const {environment} = context;

  const subProcessApi = Object.assign(activity, {
    context,
    isSubProcess: true,
    activate: activateSubProcess,
    getChildActivityById: context.getChildActivityById,
    run: runSubProcess,
  });

  return subProcessApi;

  function runSubProcess(message) {
    return activateSubProcess().run(message);
  }

  function activateSubProcess(state) {
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
      const input = executionContext.getInput();
      if (input && input.isLoopContext) {
        input.isLoopContext = undefined;
      }

      const subEnvironment = environment.clone(input);
      const subContext = context.getSubContext(id, subEnvironment);
      const processExecution = ProcessExecution(activityApi, subContext, emitter);

      return processExecution.execute(callback);

      function emitter(eventName) {
        if (eventName === 'cancel') {
          debug(`<${id}> cancelled`);
          state.entered = undefined;
          state.cancelled = true;
          processExecution.stop();
          discardAllOutbound(executionContext);
        }
      }
    }

    function run(message, inboundFlow) {
      const executionContext = ActivityExecution(subProcessApi, message, environment, inboundFlow);
      enter(executionContext);
      const completeFn = completeCallback(executionContext, environment);

      if (loop) return runLoop(executionContext, completeFn);

      emit('start', activityApi, executionContext);
      if (executionContext.isStopped()) {
        return;
      }
      execute(activityApi, executionContext, completeFn);

      return activityApi;
    }

    function resume() {
      const executionContext = ActivityExecution(subProcessApi, null, environment).resume(state);

      if (!state.entered) return;

      enter(executionContext);
      const completeFn = completeCallback(executionContext, environment);

      if (loop) return runLoop(executionContext, completeFn);

      emit('start', activityApi, executionContext);
      if (executionContext.isStopped()) {
        return;
      }
      execute(activityApi, executionContext, completeFn);

      return activityApi;
    }

    function runLoop(executionContext, callback) {
      const executionLoop = TaskExecutionLoop(activityApi, executionContext, (...args) => {
        execute(activityApi, ...args);
      }, emitter);

      if (state.loop) {
        return executionLoop.resume(state, callback);
      }

      return executionLoop.execute(callback);

      function emitter(eventName, ...args) {
        switch (eventName) {
          case 'start':
            onIterationStart(eventName, ...args);
            break;
          case 'end':
            onIterationEnd(eventName, ...args);
            break;
        }
      }

      function onIterationStart(eventName, loopApi, loopExecution) {
        emit('start', activityApi, loopExecution);
      }

      function onIterationEnd(eventName, loopApi, loopExecution) {
        emit('end', activityApi, loopExecution);
      }
    }

    function enter(executionContext) {
      if (state.taken) state.taken = undefined;
      state.entered = true;
      debug(`<${id}> enter`);
      emit('enter', activityApi, executionContext);
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
      const activityExecution = ActivityExecution(subProcessApi, null, environment.getVariablesAndServices(), inboundFlow, rootFlow);
      enter(activityExecution);
      discardAllOutbound(activityExecution, rootFlow);
    }

    function takeAllOutbound(executionContext) {
      emit('end', activityApi, executionContext);
      debug(`<${id}> take all outbound (${outbound.length})`);
      executionContext.takeAllOutbound();
      asyncEmit('leave', activityApi, executionContext);
    }

    function discardAllOutbound(executionContext, rootFlow) {
      debug(`<${id}> discard all outbound (${outbound.length})`);
      if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
      state.entered = undefined;
      emit('leave', activityApi, executionContext);
    }

    function completeCallback(executionContext, execEnvironment) {
      return callback;

      function callback(err) {
        state.entered = undefined;
        if (err) return emit('error', err, activityApi, executionContext);
        executionContext.setResult(execEnvironment.getOutput());

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
          getOutput: executionContext.getOutput,
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
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }
}
