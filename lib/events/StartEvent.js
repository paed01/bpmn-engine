'use strict';

const EventActivity = require('./event-activity');
const {EventEmitter} = require('events');

function StartEvent(activity) {
  Object.assign(this, activity);
  this.isStart = true;
  this.isStartEvent = true;
}

StartEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = StartEvent;

StartEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

StartEvent.prototype.activate = function(state) {
  const event = this;

  state = state || {};
  return EventActivity(event, executeFn, state);

  function executeFn(activityApi, executionContext, eventDefinitions, callback) {
    if (eventDefinitions.length) return eventDefinitions.forEach(({execute}) => execute());

    if (event.form || event.formKey) {
      const postponedExecution = executionContext.postpone((err, ...args) => {
        state.waiting = undefined;

        if (!err) executionContext.assignResult(...args);

        callback(err, ...args);
      });
      state.waiting = true;
      return event.emit('wait', activityApi, postponedExecution);
    }

    return callback();
  }
};
