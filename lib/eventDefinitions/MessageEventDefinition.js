'use strict';

const Debug = require('debug');

module.exports = function MessageEventDefinition(eventDefinition) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const cancelActivity = eventDefinition.cancelActivity;
  const eventState = {};

  const definitionApi = {
    id,
    type,
    cancelActivity,
    activate
  };

  return definitionApi;

  function activate(parentApi, parentExecutionContext, emit) {
    let deactivated;

    debug(`<${id}> listen for messages`);

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

      eventState.waiting = true;

      parentExecutionContext.postpone((err, ...args) => {
        eventState.waiting = undefined;

        if (err) return emit('error', err);

        parentExecutionContext.assignResult(...args);

        debug(`<${id}> message received`);

        emit('end', activityApi, parentExecutionContext);
        emit('leave', activityApi, parentExecutionContext);
      });

      emit('wait', activityApi, parentExecutionContext);
    }

    function getState() {
      return Object.assign({}, eventState);
    }

    function stop() {
      deactivate();
    }

    function deactivate() {
      deactivated = true;
    }
  }
};
