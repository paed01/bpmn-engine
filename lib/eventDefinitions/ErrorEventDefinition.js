'use strict';

const Debug = require('debug');

module.exports = function ErrorEventDefinition(eventDefinition, state, source) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const cancelActivity = eventDefinition.cancelActivity;
  const errorCodeVariable = eventDefinition.errorCodeVariable;
  const errorMessageVariable = eventDefinition.errorMessageVariable;
  const definitionState = Object.assign({
    id,
    type
  }, state);

  const errorReference = eventDefinition.getErrorRef(definitionState.errorId);

  const definitionApi = {
    id,
    type,
    cancelActivity,
    activate
  };

  return definitionApi;

  function activate(parentApi, parentExecutionContext, emit) {
    let deactivated;

    debug(`<${id}> listen for errors from <${source.id}>`);

    const activityApi = {
      type,
      cancelActivity,
      deactivate,
      getState,
      execute,
      stop
    };

    parentExecutionContext.addStateSource(getState);
    parentExecutionContext.addStopFn(stop);

    emit('enter', activityApi, parentExecutionContext);

    return activityApi;

    function execute() {
      if (deactivated) return;
      definitionState.entered = true;
      source.prependListener('error', onSourceError);
      emit('start', activityApi, parentExecutionContext);
    }

    function onSourceError(sourceError) {
      debug(`<${id}> error caught: ${sourceError.message}`);
      const bpmnError = createError(sourceError);
      emit('catch', bpmnError, parentApi, parentExecutionContext);
      complete(bpmnError);
    }

    function complete(bpmnError) {
      deactivate();
      parentExecutionContext.setResult(getResult(bpmnError));
      emit('leave', activityApi, parentExecutionContext);
    }

    function stop() {
      deactivate();
    }

    function deactivate() {
      if (deactivated) return;
      deactivated = true;
      definitionState.entered = undefined;

      debug(`<${id}> remove listener for errors from <${source.id}>`);

      source.removeListener('error', onSourceError);
    }

    function getState() {
      const result = {};
      if (errorReference) {
        result.errorId = errorReference.id;
      }
      return result;
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
