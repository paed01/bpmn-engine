'use strict';

const debug = require('debug')('bpmn-engine:activity:userTask');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  debug('init', activity.id);
  this.activity = activity;
  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);

  this.isEnd = this.outbound.length === 0;
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function() {
  debug('run', this.activity.id);
  this.taken = true;
  this.emit('start', this);
  this.emit('wait', this);
};

internals.Activity.prototype.signal = function(input) {
  this.dataOutput = input;
  this.emit('end', this, input);
  takeAll.call(this, this.outbound);
};

internals.Activity.prototype.cancel = function() {
  // No op since the task waits for signal
};

function takeAll(outbound, variables) {
  if (this.isEnd) return;

  debug(`take all ${this.activity.id} ${outbound.length} sequence flows`);
  outbound.forEach(take.bind(this, variables));
}

function take(variables, outboundSequenceFlow) {
  outboundSequenceFlow.take(variables);
}
