'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  this.id = activity.id;
  this.type = activity.$type;
  this.activity = activity;

  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);

  this.isStart = this.inbound.length === 0;
  this.isEnd = this.outbound.length === 0;
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.activate = function() {
  this.setupEventListeners();
};

internals.Activity.prototype.deactivate = function() {
  this.teardownEventListeners();
};

internals.Activity.prototype.run = function() {
  this.canceled = false;
  this.enter();
};

internals.Activity.prototype.leave = function() {
  if (!this.entered) {
    throw new Error(`Already left <${this.id}>`);
  }

  this.entered = false;
  setImmediate(this.emit.bind(this, 'leave', this));
};

internals.Activity.prototype.enter = function() {
  if (this.entered) {
    throw new Error(`Already entered <${this.id}>`);
  }

  this.entered = true;
  this.emit('enter', this);
};

internals.Activity.prototype.onInbound = function(flow, variables, rootFlow) {
  if (flow.discarded) {
    return this.cancel(variables, rootFlow || flow);
  }
  return this.run(variables, flow);
};

internals.Activity.prototype.cancel = function(variables, rootFlow) {
  this.canceled = true;
  if (!this.entered) this.enter();

  this.emit('cancel', this);

  this.discardAllOutbound(variables, rootFlow);
};

internals.Activity.prototype.takeAllOutbound = function(variables) {
  if (!this.isEnd) {
    this.outbound.forEach((flow) => flow.take(variables));
  }
  this.leave();
};

internals.Activity.prototype.discardAllOutbound = function(variables, rootFlow) {
  if (!this.isEnd) {
    this.outbound.forEach((flow) => flow.discard(variables, rootFlow));
  }
  this.leave();
};

internals.Activity.prototype.setupEventListeners = function() {
  if (!this.inbound.length) return;

  this._onInbound = this.onInbound.bind(this);

  this.inbound.forEach((flow) => {
    flow.on('taken', this._onInbound);
    flow.on('discarded', this._onInbound);
  });
};

internals.Activity.prototype.teardownEventListeners = function() {
  if (!this.inbound.length) return;
  if (!this._onInbound) return;

  this.inbound.forEach((flow) => {
    flow.removeListener('taken', this._onInbound);
    flow.removeListener('discarded', this._onInbound);
  });
};
