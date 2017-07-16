'use strict';

const EventActivity = require('./event-activity');
const {EventEmitter} = require('events');

function IntermediateCatchEvent(activity) {
  Object.assign(this, activity);
}

IntermediateCatchEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = IntermediateCatchEvent;

IntermediateCatchEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

IntermediateCatchEvent.prototype.activate = function(state) {
  const event = this;

  state = state || {};
  return EventActivity(event, executeFn, state);

  function executeFn(activityApi, executionContext, eventDefinitions, callback) {
    if (eventDefinitions.length) return eventDefinitions.forEach(({execute}) => execute());
    return callback();
  }
};
