'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  this.id = activity.id;
  this.type = activity.$type;
  this.activity = activity;
  this.boundEvents = parent.getBoundaryEvents(activity.id);

  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);

  this.isStart = this.inbound.length === 0;
  this.isEnd = this.outbound.length === 0;
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.activate = function() {
  this.listenForInbound();
};

internals.Activity.prototype.deactivate = function() {
  this.teardownInboundListeners();
};

internals.Activity.prototype.run = function() {
  this.enter();
};

internals.Activity.prototype.enter = function() {
  this.entered = true;
  this.emit('enter', this);
};

internals.Activity.prototype.inboundListener = function(flow, variables, rootFlow) {
  if (flow.discarded) {
    return this.cancel(variables, rootFlow || flow);
  }
  return this.run(variables, flow);
};

internals.Activity.prototype.cancel = function(variables, rootFlow) {
  this.canceled = true;
  this.enter();
  this.emit('cancel', this);
  if (!this.isEnd) {
    this.discardAllOutbound(variables, rootFlow);
  }
};

internals.Activity.prototype.takeAllOutbound = function(variables) {
  if (this.isEnd) return;
  this.outbound.forEach((flow) => flow.take(variables));
};

internals.Activity.prototype.discardAllOutbound = function(variables, rootFlow) {
  if (this.isEnd) return;
  this.outbound.forEach((flow) => flow.discard(variables, rootFlow));
};

internals.Activity.prototype.listenForInbound = function() {
  if (!this.inbound.length) return;

  this._inboundListener = this.inboundListener.bind(this);

  this.inbound.forEach((flow) => {
    flow.on('taken', this._inboundListener);
    flow.on('discarded', this._inboundListener);
  });
};

internals.Activity.prototype.teardownInboundListeners = function() {
  if (!this.inbound.length) return;
  if (!this._inboundListener) return;

  this.inbound.forEach((flow) => {
    flow.removeListener('taken', this._inboundListener);
    flow.removeListener('discarded', this._inboundListener);
  });
};
