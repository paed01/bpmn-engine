'use strict';

const Debug = require('debug');

module.exports = function ErrorEventDefinition(eventDefinition, state, source, emit) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const cancelActivity = eventDefinition.cancelActivity;

  const eventState = Object.assign({
    id,
    type
  }, state);

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
    return result;
  }

  function init(parentApi, executionContext) {
    let deactivated;

    debug(`<${id}> listen for messages`);

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

      executionContext.postpone(callback);

      eventState.entered = true;
      eventState.waiting = true;

      emit('wait', activityApi, executionContext);
    }

    function getExecutionState() {
      return {};
    }

    function stop() {
      deactivate();
    }

    function deactivate() {
      deactivated = true;
    }
  }
};
