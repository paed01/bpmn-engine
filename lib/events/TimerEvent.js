'use strict';

const EventDefinition = require('../activities/EventDefinition');
const moment = require('moment');
const util = require('util');

const internals = {};

module.exports = internals.TimerEvent = function() {
  EventDefinition.apply(this, arguments);
  this.duration = this.eventDefinition.timeDuration.body;
  this.timeout = moment.duration(this.duration).asMilliseconds();
  this._debug(`<${this.id}>`, `timeout ${this.timeout}ms`);
};

util.inherits(internals.TimerEvent, EventDefinition);

internals.TimerEvent.prototype.run = function() {
  this._debug(`<${this.id}>`, `run for duration ${this.duration}`);
  delete this.stoppedAt;
  this.startedAt = new Date();

  this.timer = setTimeout(() => {
    this._debug(`<${this.id}>`, 'timed out');
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
