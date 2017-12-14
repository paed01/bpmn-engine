'use strict';

const EventActivity = require('./event-activity');

module.exports = function StartEvent(activity) {
  const {id, type} = activity;

  const eventApi = Object.assign(activity, {
    activate,
    getState,
    run,
  });

  return eventApi;

  function run(message) {
    return activate().run(message);
  }

  function activate(state) {
    return EventActivity(eventApi, executeFn, state);

    function executeFn(activityApi, executionContext, activatedEventDefinitions, callback) {
      if (activatedEventDefinitions.length) {
        return activatedEventDefinitions.forEach(({execute}) => execute(`<${id}> start`));
      }

      if (executionContext.getForm()) {
        const postponedExecution = executionContext.postpone((err, ...args) => {
          if (!err) executionContext.setResult(...args);
          callback(err, ...args);
        });
        return eventApi.emit('wait', activityApi, postponedExecution);
      }

      return callback();
    }
  }

  function getState() {
    return {
      id,
      type
    };
  }
};
