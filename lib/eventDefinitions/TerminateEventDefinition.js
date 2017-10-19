'use strict';

module.exports = function TerminateEventDefinition(activityElement, eventDefinition) {
  const {id, $type: type} = eventDefinition;

  return {
    id,
    type,
    activate,
    getState,
    resume,
  };

  function resume(state, parentApi, activityExecution, emit) {
    return activate(parentApi, activityExecution, emit);
  }

  function getState() {
    return {
      terminate: true
    };
  }

  function activate(parentApi, activityExecution, emit) {
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

    function execute() {
      return onStart();
    }

    function onEnter() {
      emit('enter', parentApi, activityExecution);
    }

    function onStart() {
      emit('start', parentApi, activityExecution);
      emit('terminate', parentApi, activityExecution);
    }

    function onLeave() {}
    function onEnd() {}
    function onMessage() {}
    function onCancel() {}
    function onError() {}
  }
};
