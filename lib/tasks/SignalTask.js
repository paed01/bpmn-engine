'use strict';

const TaskActivity = require('./TaskActivity');

module.exports = function SignalTask(activity) {
  const {id, type} = activity;

  const taskApi = Object.assign(activity, {
    activate,
    getState,
    run,
  });

  return taskApi;

  function run(message) {
    return activate().run(message);
  }

  function activate(state) {
    state = state || getState();
    return TaskActivity(taskApi, executeFn, state);

    function executeFn(activityApi, executionContext, callback) {
      const postponedExecution = executionContext.postpone((...args) => {
        state.waiting = undefined;
        callback(...args);
      });
      state.waiting = true;

      taskApi.emit('wait', activityApi, postponedExecution);
    }
  }

  function getState() {
    return {
      id,
      type
    };
  }
};
