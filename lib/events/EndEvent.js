'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:event:endEvent');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Event = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
  this.isEnd = true;
  this.taken = false;
  this.terminate = contextHelper.isTerminationElement(activity);
};

util.inherits(internals.Event, Activity);

internals.Event.prototype.run = function() {
  Activity.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this.taken = true;
  setImmediate(this.emit.bind(this, 'end', this));
  this.leave();
};

internals.Event.prototype.cancel = function() {
  Activity.prototype.cancel.apply(this, arguments);
  debug(`<${this.id}>`, 'cancel');
};

internals.Event.prototype.enter = function() {
  debug(`<${this.id}>`, 'enter');
  Activity.prototype.enter.apply(this, arguments);
};

internals.Event.prototype.leave = function() {
  debug(`<${this.id}>`, 'leave');
  Activity.prototype.leave.apply(this, arguments);
};
