'use strict';

const Debug = require('debug');

module.exports = function ErrorEventDefinition(activityElement, eventDefinition, parentContext) {
  const {id: activityId} = activityElement;
  let {id} = eventDefinition;
  if (!id) id = activityId;

  const {contextHelper} = parentContext;
  const {$type: type} = eventDefinition;

  let errorId = getErrorReferenceId();

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  debug(`<${id}> loaded`);

  return {
    id,
    type,
    activate,
    getState,
    resume,
  };

  function resume(state, parentApi, activityExecution, emit) {
    errorId = state.errorId;
    return activate(parentApi, activityExecution, emit);
  }

  function getState() {
    return {
      errorId
    };
  }

  function activate(parentApi, activityExecution, emit) {
    const io = activityExecution.getIo();
    let errorReference;

    return {
      id,
      type,
      execute,
      getState,
      onStart,
      onEnter,
      onMessage,
      onEnd,
      onCancel,
      onLeave,
      onError,
      stop
    };

    function stop() {}

    function execute(message) {
      debug(`<${id}> execute: ${message}`);
      const bpmnError = createError(new Error(message), parentApi);

      io.setOutputValue('errorCode', bpmnError.errorCode);
      io.setOutputValue('errorMessage', bpmnError.message);

      emit('error', bpmnError, parentApi, activityExecution);
    }

    function onEnter() {}
    function onStart() {
      emit('start', parentApi, activityExecution);
    }
    function onLeave() {}
    function onEnd() {}
    function onMessage() {}
    function onCancel() {}
    function onError(error, errorSource) {
      debug(`<${id}> error caught: ${error.message}`);
      const bpmnError = createError(error, errorSource);

      io.setOutputValue('errorCode', bpmnError.errorCode);
      io.setOutputValue('errorMessage', bpmnError.message);

      emit('catch', bpmnError, parentApi, activityExecution);
    }

    function getErrorReference() {
      if (errorReference) return errorReference;
      if (errorId) return parentContext.getActivityById(errorId);
    }

    function createError(error, source) {
      const errref = getErrorReference();
      if (errref) return errref.create(error, source);
      return error;
    }
  }

  function getErrorReferenceId() {
    const ref = contextHelper.getErrorByReference(eventDefinition);
    if (ref) return ref.id;
  }
};
