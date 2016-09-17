'use strict';

const debug = require('debug')('bpmn-engine:event:timerEventDefinition');
const EventEmitter = require('events').EventEmitter;
const moment = require('moment');
const util = require('util');

const internals = {};

module.exports = internals.TimerEventDefinition = function(activity, parent) {
  this.activity = activity;
  this.type = activity.$type;
  this.timeout = moment.duration(activity.timeDuration.body).asMilliseconds();
  debug(`init for <${parent.id}> with timeout ${this.timeout}ms`);
};

util.inherits(internals.TimerEventDefinition, EventEmitter);

internals.TimerEventDefinition.prototype.run = function() {
  debug(`run for duration ${this.activity.timeDuration.body}`);
  this.emit('start', this);
  this.timer = setTimeout(() => {
    debug('timed out');
    this.emit('end', this);
  }, this.timeout);
};

internals.TimerEventDefinition.prototype.cancel = function() {
  this.canceled = true;
  debug(`canceled timeout ${this.timeout}ms`);
  if (this.timer) {
    clearTimeout(this.timer);
    delete this.timer;
    this.emit('cancel', this);
  }
};
