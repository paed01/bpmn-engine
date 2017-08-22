'use strict';

const Debug = require('debug');

module.exports = function ErrorEventDefinition(eventDefinition, state, source) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const cancelActivity = eventDefinition.cancelActivity;
  const io = eventDefinition.getIO();

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
    const emitErrorImmediately = source.id === parentExecutionContext.id;
    let deactivated;

    const activityApi = {
      type,
      cancelActivity,
      deactivate,
      getState,
      execute,
      stop
    };

    parentExecutionContext.addStateSource(getState);
    parentExecutionContext.addOutputSource(io);
    parentExecutionContext.addStopFn(stop);

    emit('enter', activityApi, parentExecutionContext);

    return activityApi;

    function execute() {
      if (deactivated) return;
      definitionState.entered = true;

      if (!emitErrorImmediately) {
        debug(`<${id}> listen for errors from <${source.id}>`);
        source.prependListener('error', onSourceError);
        return emit('start', activityApi, parentExecutionContext);
      }

      complete(createError(new Error(`<${source.id}> error event`)));
    }

    function onSourceError(sourceError) {
      debug(`<${id}> error caught: ${sourceError.message}`);
      const bpmnError = createError(sourceError);
      emit('catch', bpmnError, parentApi, parentExecutionContext);
      complete(bpmnError);
    }

    function complete(bpmnError) {
      io.setOutputValue(errorCodeVariable, bpmnError.errorCode);
      io.setOutputValue(errorMessageVariable, bpmnError.message);

      deactivate();

      if (!emitErrorImmediately) {
        return emit('leave', activityApi, parentExecutionContext);
      }
      emit('error', bpmnError, activityApi, parentExecutionContext);
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
  }
};
