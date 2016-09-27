'use strict';

const debug = require('debug');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parentContext) {
  this.parentContext = parentContext;
  this.id = activity.id;
  this.type = activity.$type;
  this.name = activity.name;
  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);
  this.activity = activity;

  this.inbound = parentContext.getInboundSequenceFlows(activity.id);
  this.outbound = parentContext.getOutboundSequenceFlows(activity.id);

  this.io = parentContext.getActivityIO(activity.id);

  this.multipleInbound = this.inbound.length > 1;
  this.isStart = this.inbound.length === 0;
  this.isEnd = this.outbound.length === 0;

  this._debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.activate = function() {
  this.setupInboundListeners();
};

internals.Activity.prototype.deactivate = function() {
  this.teardownInboundListeners();
};

internals.Activity.prototype.run = function() {
  this.canceled = false;
  this.enter();
};

internals.Activity.prototype.signal = function() {
};

internals.Activity.prototype.enter = function() {
  this._debug(`<${this.id}>`, 'enter');
  if (this.entered) {
    throw new Error(`Already entered <${this.id}>`);
  }

  this.entered = true;
  this.emit('enter', this);
};

internals.Activity.prototype.leave = function() {
  this._debug(`<${this.id}>`, 'leave');
  if (!this.entered) {
    throw new Error(`Already left <${this.id}>`);
  }

  this.pendingDiscard = false;
  this.entered = false;
  setImmediate(this.emit.bind(this, 'leave', this));
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;

  this._debug(`<${this.id}>`, 'cancel');
  this.emit('cancel', this);

  this.takeAllOutbound();
};

internals.Activity.prototype.onInbound = function(flow) {
  if (flow.discarded) {
    return discardedInbound.apply(this, arguments);
  }
  return this.run(flow);
};

internals.Activity.prototype.discard = function(flow, rootFlow) {
  if (!this.entered) this.enter();
  return this.discardAllOutbound(rootFlow);
};

function discardedInbound(flow, rootFlow) {
  if (!this.multipleInbound) {
    return this.discard(flow, rootFlow);
  }

  if (!this.pendingDiscard) {
    this._debug(`<${this.id}>`, `pending inbound from discarded <${flow.id}>`);
    this.pendingDiscard = true;

    // Remove one since one inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    return;
  }

  this.pendingLength--;
  this._debug(`<${this.id}>`, `inbound from discarded <${flow.id}> - pending ${this.pendingLength}`);
  if (this.pendingLength === 0) {
    this.discard();
  }
}

internals.Activity.prototype.takeAllOutbound = function(message) {
  if (!this.isEnd) {
    this._debug(`<${this.id}>`, `take all outbound (${this.outbound.length})`);
    this.outbound.forEach((flow) => flow.take(message));
  }
  this.leave();
};

internals.Activity.prototype.discardAllOutbound = function(rootFlow) {
  if (!this.isEnd) {
    this._debug(`<${this.id}>`, `discard all outbound (${this.outbound.length})`);
    this.outbound.forEach((flow) => {
      flow.discard(rootFlow);
    });
  }
  this.leave();
};

internals.Activity.prototype.setupInboundListeners = function() {
  if (!this.inbound.length) return;
  if (this._onInbound) return;
  this._onInbound = this.onInbound.bind(this);

  this.inbound.forEach((flow) => {
    flow.on('taken', this._onInbound);
    flow.on('discarded', this._onInbound);
  });
};

internals.Activity.prototype.teardownInboundListeners = function() {
  if (!this._onInbound) return;
  this.inbound.forEach((flow) => {
    flow.removeListener('taken', this._onInbound);
    flow.removeListener('discarded', this._onInbound);
  });

  delete this._onInbound;
};

internals.Activity.prototype.getOutput = function(variables) {
  if (!this.io) return {};
  return this.io.getOutput(variables);
};

internals.Activity.prototype.getInput = function(variables) {
  if (!this.io) return {};
  return this.io.getInput(variables);
};
