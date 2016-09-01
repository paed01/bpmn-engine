'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:activity:endEvent');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  debug('init', activity.id);

  this.id = activity.id;
  this.activity = activity;
  this.taken = false;
  this.terminate = contextHelper.isTerminationElement(activity);
  this.inbound = parent.getInboundSequenceFlows(activity.id);

  this.isEnd = true;
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function() {
  debug('run', this.activity.id);
  this.taken = true;
  this.emit('end', this);
};

internals.Activity.prototype.cancel = function() {
  // No op
};
