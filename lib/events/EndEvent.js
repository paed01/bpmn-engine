'use strict';

const EventActivity = require('./event-activity');
const {EventEmitter} = require('events');

function EndEvent(activity) {
  Object.assign(this, activity);
}

EndEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = EndEvent;

EndEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

EndEvent.prototype.activate = function(state) {
  const event = this;

  state = state || {};
  return EventActivity(event, executeFn, state);

  function executeFn(activityApi, executionContext, eventDefinitions, callback) {
    if (eventDefinitions.length) return eventDefinitions.forEach(({execute}) => execute());
    return callback();
  }
};
