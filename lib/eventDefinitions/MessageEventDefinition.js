'use strict';

const Debug = require('debug');

module.exports = function MessageEventDefinition(activityElement, eventDefinition) {
  const {id: activityId} = activityElement;
  let {id} = eventDefinition;
  if (!id) id = activityId;
  const {$type: type} = eventDefinition;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    id,
    type,
    activate,
    getState,
    resume,
  };

  function getState() {}
  function resume() {}

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
      debug(`<${id}> wait for message`);
      emit('wait', parentApi, activityExecution);
    }

    function onLeave() {}
    function onEnd() {}
    function onMessage() {}
    function onCancel() {}
    function onError() {}

    // function onError() {}

    // const io = parentExecutionContext.getIo();
    // let deactivated;

    // debug(`<${id}> listen for messages`);

    // const activityApi = {
    //   type,
    //   deactivate,
    //   getState,
    //   execute,
    //   stop
    // };

    // emit('enter', activityApi, parentExecutionContext);

    // return activityApi;

    // function execute() {
    //   if (deactivated) return;

    //   eventState.waiting = true;

    //   parentExecutionContext.postpone((err, ...args) => {
    //     eventState.waiting = undefined;

    //     if (err) return emit('error', err);

    //     io.setResult(...args);

    //     debug(`<${id}> message received`);

    //     emit('end', activityApi, parentExecutionContext);
    //     emit('leave', activityApi, parentExecutionContext);
    //   });

    //   emit('wait', activityApi, parentExecutionContext);
    // }

    // function getState() {
    //   return Object.assign({}, eventState);
    // }

    // function stop() {
    //   deactivate();
    // }

    // function deactivate() {
    //   deactivated = true;
    // }
  }
};
