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

  debug('init', activity.id, this.join ? 'joining' : '');
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  debug('run', this.activity.id);
  if (this.join) return this.runJoin(variables);

  this.emit('start', this);
  this.complete(variables);
};

internals.Activity.prototype.complete = function(variables) {
  this.pendingJoin = false;
  this.emit('end', this);
  takeAll.call(this, this.outbound, variables);
};

internals.Activity.prototype.runJoin = function(variables) {
  if (!this.pendingJoin) {
    this.emit('start', this);
    this.pendingJoin = true;
    return setUpInbound.call(this, this.inbound, variables);
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

function setUpInbound(inbound, variables) {
  const self = this;
  const pending = inbound.filter((flow) => !flow.taken);
  let pendingLength = pending.length;
  function flowTouched() {
    pendingLength = pendingLength - 1;
    if (pendingLength <= 0) {
      self.complete(variables);
    }
  }

  pending.forEach((flow) => {
    flow.once('taken', flowTouched);
    flow.once('discarded', flowTouched);
  });
}
