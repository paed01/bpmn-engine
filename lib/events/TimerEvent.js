'use strict';

const EventDefinition = require('../activities/EventDefinition');
const expressions = require('../expressions');
const iso8601duration = require('iso8601-duration');

const internals = {};

module.exports = internals.TimerEvent = function(activity) {
  EventDefinition.apply(this, arguments);
  this.duration = activity.eventDefinition.timeDuration;
  this._debug(`<${this.id}>`, `timeout ${this.duration}`);
};

internals.TimerEvent.prototype = Object.create(EventDefinition.prototype);

internals.TimerEvent.prototype.run = function() {
  delete this.stoppedAt;
  this.startedAt = new Date();

  this.timeout = this.hasOwnProperty('timeout') ? this.timeout : resolveDuration.call(this, this.duration);
  this._debug(`<${this.id}>`, `run for duration ${this.timeout}ms`);

  this.timer = setTimeout(() => {
    this._debug(`<${this.id}>`, 'timed out');
    delete this.timeout;
    this.complete();
  }, this.timeout);
  this.emit('start', this);
  EventDefinition.prototype.run.call(this);
};

internals.TimerEvent.prototype.discard = function() {
  this._debug(`<${this.id}>`, `cancel timeout ${this.timeout}ms`);
  clearTimeout(this.timer);
  delete this.timer;
  EventDefinition.prototype.discard.call(this);
};

internals.TimerEvent.prototype.onAttachedEnd = function(activity) {
  this._debug(`<${this.id}>`, `activity <${activity.id}> ended`);
  if (this.cancelActivity) this.discard();
};

internals.TimerEvent.prototype.resume = function(state) {
  if (state.hasOwnProperty('timeout')) {
    this._debug(`<${this.id}>`, `resume from ${state.timeout}ms`);
    this.timeout = state.timeout;
  }
};

internals.TimerEvent.prototype.deactivate = function() {
  EventDefinition.prototype.deactivate.apply(this, arguments);
  this.stoppedAt = new Date();
  if (this.timer) {
    clearTimeout(this.timer);
  }
};

internals.TimerEvent.prototype.getState = function() {
  const state = EventDefinition.prototype.getState.apply(this, arguments);
  if (!this.entered) return state;

  const stoppedAt = this.stoppedAt || new Date();

  return Object.assign(state, {
    timeout: this.timeout - (stoppedAt - this.startedAt),
    attachedToId: this.attachedTo.id
  });
};

function resolveDuration(duration) {
  duration = expressions(duration, this.parentContext.getFrozenVariablesAndServices());
  return iso8601duration.toSeconds(iso8601duration.parse(duration)) * 1000;
}
