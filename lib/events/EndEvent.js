'use strict';

const EventActivity = require('./event-activity');
const {EventEmitter} = require('events');

module.exports = function EndEvent(activityEvent) {
  const {id, type} = activityEvent;

  const eventApi = Object.assign(new EventEmitter(), activityEvent, {
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
  }

  function executeFn(activityApi, executionContext, activatedEventDefinitions, callback) {
    if (activatedEventDefinitions.length) {
      return activatedEventDefinitions.forEach(({execute}) => execute(`<${id}> end`));
    }
    return callback();
  }

  function getState() {
    return {
      id,
      type
    };
  }
};
