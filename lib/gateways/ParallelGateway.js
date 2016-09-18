'use strict';

const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Gateway = function() {
  Activity.apply(this, arguments);
  this.join = this.inbound.length > 1;
  this.pendingJoin = !this.join;
  this.pendingLength = 0;
};

util.inherits(internals.Gateway, Activity);

internals.Gateway.prototype.run = function() {
  // No op
};

internals.Gateway.prototype.onInbound = function(flow, rootFlow) {
  if (flow.discarded) {
    this._debug(`<${this.id}>`, `<${flow.id}> discarded`);
    return this.runInbound(flow, rootFlow);
  }

  this._debug(`<${this.id}>`, `<${flow.id}> taken`);
  return this.runInbound(flow, rootFlow);
};

internals.Gateway.prototype.runInbound = function(flow, rootFlow) {
  if (!this.join) {
    Activity.prototype.run.call(this);
    return this.complete(flow, rootFlow);
  }
  return this.runJoin(flow, rootFlow);
};

internals.Gateway.prototype.runJoin = function(takenFlow) {
  if (!this.pendingJoin) {
    Activity.prototype.run.call(this);

    this._debug(`<${this.id}>`, `join initialised from ${takenFlow.discarded ? 'discarded' : 'taken'} <${takenFlow.id}>`);
    this.pendingJoin = true;
    this.emit('start', this);

    // Remove one since one inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    return;
  }

  this.pendingLength--;
  this._debug(`<${this.id}>`, `join from ${takenFlow.discarded ? 'discarded' : 'taken'} <${takenFlow.id}> - pending ${this.pendingLength}`);
  if (this.pendingLength === 0) {
    this.complete();
  }
};

internals.Gateway.prototype.complete = function() {
  this.pendingJoin = false;

  const atLeastOneTaken = this.inbound.some((flow) => flow.taken);
  if (!atLeastOneTaken) {
    this._debug(`<${this.id}>`, 'was discarded');
    return this.discardAllOutbound();
  }

  this.taken = true;
  this.emit('end', this);

  return this.takeAllOutbound();
};
