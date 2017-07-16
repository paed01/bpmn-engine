'use strict';

const Debug = require('debug');

module.exports = function TerminateEventDefinition(eventDefinition) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const cancelActivity = eventDefinition.cancelActivity;

  const definitionApi = {
    id,
    type,
    cancelActivity,
    activate
  };

  return definitionApi;

  function activate(parentApi, parentExecutionContext, emit) {
    let deactivated;

    debug(`<${id}> terminate`);

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
      emit('terminate', activityApi, parentExecutionContext);
    }

    function stop() {
      deactivate();
    }

    function deactivate() {
      if (deactivated) return;
      deactivated = true;
    }

    function getState() {
      return {
        terminate: true
      };
    }
  }
};
