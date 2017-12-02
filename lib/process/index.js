'use strict';

const debug = require('debug')('bpmn-engine:bpmn:process');
const {EventEmitter} = require('events');
const ProcessExecution = require('./Execution');

module.exports = Process;

Process.setState = function setState(state, moddleContext, environment) {
  const {id, type: $type, name} = state;
  debug(`<${id}> set state`);

  const Context = require('../Context');
  const context = Context.setState(state, moddleContext, environment);

  return ProcessInstance({id, $type, name}, context, environment);
};

function Process(activity, moddleContext, environment) {
  const Context = require('../Context');
  const context = Context(activity.id, moddleContext, environment);
  return ProcessInstance(activity, context);
}

function ProcessInstance(activity, context) {
  const {id, $type: type, name} = activity;
  const isMainProcess = true;
  const environment = context.environment;

  const processApi = Object.assign(new EventEmitter(), {
    id,
    type,
    name,
    context,
    environment,
    isMainProcess,
    activate,
    getChildActivityById,
    resume: (state) => activate(state).resume(),
    run: (message) => activate().run(message)
  });

  return processApi;

  function getChildActivityById(childId) {
    return context.getChildActivityById(childId);
  }

  function activate(state) {
    let onComplete;

    state = Object.assign(state || {}, {
      id,
      type
    });

    const activityApi = {
      id,
      type,
      deactivate,
      execute,
      getApi,
      getState,
      resume,
      run
    };

    const emit = (...args) => processApi.emit(...args);
    const processExecution = ProcessExecution(activityApi, context, emit);

    return activityApi;

    function execute(callback) {
      onComplete = completeCallback(callback);
      processExecution.execute(onComplete);
      return processExecution;
    }

    function run() {
      return execute();
    }

    function resume(callback) {
      if (!state.entered) return;
      onComplete = completeCallback(callback);
      processExecution.resume(state, onComplete);
      return processExecution;
    }

    function getState() {
      return Object.assign({}, state);
    }

    function deactivate() {
      if (processExecution) processExecution.deactivate();
    }

    function completeCallback(cb) {
      return function callback(err) {
        state.entered = undefined;
        if (err) return onCompleteErr(err);
        state.taken = true;
        debug(`<${id}> completed`);
        if (cb) cb(err, activityApi, processExecution);
      };

      function onCompleteErr(err) {
        if (cb) return cb(err, activityApi, processExecution);
        return emit('error', err, activityApi, processExecution);
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
          getChildState: executionContext.getChildState,
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
        }

        function discard() {
        }

        function stop() {
          executionContext.stop();
          deactivate();
        }
      }
    }
  }
}
