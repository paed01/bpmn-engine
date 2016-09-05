'use strict';

const debug = require('debug')('bpmn-engine:activity:parallelGateway');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  this.activity = activity;
  this.id = activity.id;

  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);
  this.join = this.inbound.length > 1;
  this.pendingJoin = !this.join;
  this.pendingLength = 0;

  debug(`init <${activity.id}>`, this.join ? 'joining' : '');
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables, takenFlow) {
  this.entered = true;
  if (this.join) return this.runJoin(variables, takenFlow);
  debug(`run <${this.id}>`);

  this.emit('start', this);
  this.complete(variables);
};

internals.Activity.prototype.complete = function(variables) {
  this.pendingJoin = false;
  this.entered = false;

  this.emit('end', this);
  takeAll.call(this, this.outbound, variables);
};

internals.Activity.prototype.runJoin = function(variables, takenFlow) {
  if (!this.pendingJoin) {
    debug(`run join <${this.id}>`);
    this.pendingJoin = true;
    this.emit('start', this);

    // Remove one since one inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    return;
  }

  this.pendingLength--;
  debug(`sequenceFlow <${takenFlow.id}> ${takenFlow.discarded ? 'discarded' : 'taken'} - pending ${this.pendingLength}`);
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
