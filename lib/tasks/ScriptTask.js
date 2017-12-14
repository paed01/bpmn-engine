'use strict';

const scriptHelper = require('../script-helper');
const TaskActivity = require('./TaskActivity');

module.exports = function ScriptTask(activity) {
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
    const {body, scriptFormat} = taskApi.getScript();

    if (!scriptHelper.isJavascript(scriptFormat)) return this.emit('error', new Error(`Script format ${scriptFormat} is unsupported (<${taskApi.id}>)`));

    state = state || getState();
    return TaskActivity(taskApi, executeFn, state);

    function executeFn(activityApi, executionContext, callback) {
      const script = scriptHelper.parse(`${executionContext.id}.script`, body);
      const io = executionContext.getIo();
      const input = io.hasIo ? io.getInput() : io.getInputContext();
      return scriptHelper.execute(script, input, callback);
    }
  }

  function getState() {
    return {
      id,
      type
    };
  }
};
