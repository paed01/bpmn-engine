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
  this.emit('start', this);
  this.timer = setTimeout(() => {
    this._debug(`<${this.id}>`, 'timed out');
    this.completed();
  }, this.timeout);
  EventDefinition.prototype.run.call(this);
};

internals.TimerEvent.prototype.discard = function() {
  this._debug(`<${this.id}>`, `cancel timeout ${this.timeout}ms`);
  clearTimeout(this.timer);
  delete this.timer;
  EventDefinition.prototype.discard.call(this);
};
