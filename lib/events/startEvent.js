'use strict';

const debug = require('debug')('bpmn-engine:activity:startEvent');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  debug('init', activity.id);
  this.activity = activity;
  this.outbound = parent.getOutboundSequenceFlows(activity.id);
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function() {
  debug('run', this.activity.id);
  this.emit('start', this);
  this.emit('end', this);
  takeAll.call(this, this.outbound);
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;
};

function takeAll(outbound, variables) {
  debug(`take all ${this.activity.id} ${outbound.length} sequence flows`);
  outbound.forEach(take.bind(this, variables));
}

function take(variables, outboundSequenceFlow) {
  if (this.canceled) return;
  outboundSequenceFlow.take(variables);
}
