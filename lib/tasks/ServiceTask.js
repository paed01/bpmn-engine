'use strict';

const TaskActivity = require('./TaskActivity');
const {EventEmitter} = require('events');

module.exports = function ServiceTask(activity) {
  const {id, type} = activity;
  const service = activity.getService();

  const taskApi = Object.assign(new EventEmitter(), activity, {
    activate,
    getState,
    run,
    service
  });

  return taskApi;

  function run(message) {
    return activate().run(message);
  }

  function activate(state) {
    state = state || getState();
    return TaskActivity(taskApi, executeFn, state);

    function executeFn(activityApi, executionContext, callback) {
      const io = executionContext.getIo();
      const inputContext = io.getInputContext();

      const activatedService = service.activate(taskApi, inputContext, executionContext);
      if (!activatedService) return callback(new Error(`<${taskApi.id}> no service definition found`));
      const input = io.hasIo ? io.getInput() : inputContext;

      return activatedService.execute(input, callback);
    }
  }

  function getState() {
    return {
      id,
      type
    };
  }
};
