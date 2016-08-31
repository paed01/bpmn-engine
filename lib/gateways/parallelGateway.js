'use strict';

const debug = require('debug')('bpmn-engine:activity:parallelGateway');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  this.activity = activity;
  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);
  this.join = this.inbound.length > 1;
  this.pendingJoin = !this.join;
  this.pendingLength = 0;

  debug('init', activity.id, this.join ? 'joining' : '');
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  debug('run', this.activity.id);
  this.entered = true;
  if (this.join) return this.runJoin(variables);

  this.emit('start', this);
  this.complete(variables);
};

internals.Activity.prototype.complete = function(variables) {
  this.pendingJoin = false;
  this.entered = false;

  if (this._discardedListener) {
    this.inbound.forEach((flow) => flow.removeListener('discarded', this._discardedListener));
    delete this._discardedListener;
  }

  this.emit('end', this);
  takeAll.call(this, this.outbound, variables);
};

internals.Activity.prototype.runJoin = function(variables) {
  if (!this.pendingJoin) {
    this.emit('start', this);
    this.pendingJoin = true;

    // Remove one since the a inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    this._discardedListener = this.flowDiscardedListener.bind(this, variables);
    this.inbound.forEach((flow) => flow.once('discarded', this._discardedListener));

    return;
  }

  this.pendingLength--;
  debug(`sequenceFlow taken - pending ${this.pendingLength}`);
  if (this.pendingLength === 0) {
    this.complete();
  }
};

internals.Activity.prototype.flowDiscardedListener = function(variables, flow) {
  this.pendingLength--;

  debug(`sequenceFlow <${flow.id}> discarded - pending ${this.pendingLength}`);

  if (this.pendingLength === 0) {
    this.complete(variables);
  }
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;
};

function takeAll(outbound, variables) {
  debug(`take all ${this.activity.id} ${outbound.length} sequence flows`);
  outbound.forEach((flow) => {
    if (this.canceled) return;
    flow.take(variables);
  });
}
