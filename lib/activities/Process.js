'use strict';

const debug = require('debug')('bpmn-engine:bpmn:process');
const {EventEmitter} = require('events');
const ProcessExecution = require('./process-execution');

function Process(activity, moddleContext, environment) {
  this.id = activity.id;
  this.type = activity.$type;
  this.name = activity.name;
  this.activity = activity;
  this.isMainProcess = true;
  this.environment = environment;

  const Context = require('../Context');
  this.context = new Context(this.id, moddleContext, this.environment);
}

Process.prototype = Object.create(EventEmitter.prototype);

module.exports = Process;

Process.prototype.run = function runProcess(message) {
  return this.activate().run(message);
};

Process.prototype.resume = function resumeProcess(state) {
  return this.activate(state).resume();
};

Process.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const emit = scope.emit.bind(scope);
  const context = scope.context;

  let onComplete, processExecution;

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

  activate();

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

  function activate() {
    processExecution = ProcessExecution(activityApi, context, emit, completeCallback);
  }

  function deactivate() {
    if (processExecution) processExecution.deactivate();
  }

  function completeCallback(executionContext) {
    return callback;

    function callback(err) {
      delete state.entered;
      if (err) return emit('error', err, activityApi, executionContext);
      state.taken = true;
      debug(`<${id}> completed`);
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
      }

      function discard() {
      }

      function stop() {
        executionContext.stop();
        deactivate();
      }
    }
  }
};
