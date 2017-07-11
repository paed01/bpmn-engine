'use strict';

const Debug = require('debug');

module.exports = function ErrorEventDefinition(eventDefinition, state, source, emit) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const cancelActivity = eventDefinition.cancelActivity;
  const errorCodeVariable = eventDefinition.errorCodeVariable;
  const errorMessageVariable = eventDefinition.errorMessageVariable;

  const eventState = Object.assign({
    id,
    type
  }, state);

  const errorReference = eventDefinition.getErrorRef(eventState.errorId);

  const activityApi = {
    id,
    type,
    cancelActivity,
    getState,
    init
  };

  return activityApi;

  function getState() {
    const result = {};
    if (errorReference) {
      result.errorId = errorReference.id;
    }
    return result;
  }

  function init(parentApi, executionContext) {
    let completeCallback, deactivated;

    debug(`<${id}> listen for errors from <${source.id}>`);

    return {
      cancelActivity,
      type,
      deactivate,
      getState: getExecutionState,
      start,
      stop
    };

    function start(callback) {
      if (deactivated) return;

      eventState.entered = true;
      completeCallback = callback;

      source.prependListener('error', onSourceError);
    }

    function onSourceError(sourceError) {
      debug(`<${id}> error caught`);
      const bpmnError = createError(sourceError);
      emit('catch', bpmnError, parentApi, executionContext);
      complete(bpmnError);
    }

    function getExecutionState() {
      return {};
    }

    function stop() {
      deactivate();
    }

    function complete(bpmnError) {
      deactivate();
      executionContext.setResult(getResult(bpmnError));
      completeCallback(null, cancelActivity);
    }

    function deactivate() {
      deactivated = true;
      delete eventState.entered;
      source.removeListener('error', onSourceError);
    }

    function createError(sourceError) {
      if (errorReference) return errorReference.create(sourceError, source);
      return sourceError;
    }

    function getResult(bpmnError) {
      const result = {};
      result[errorCodeVariable] = bpmnError.errorCode;
      result[errorMessageVariable] = bpmnError.message;
      return result;
    }
  }
};
