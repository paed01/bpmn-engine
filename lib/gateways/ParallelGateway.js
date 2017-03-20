'use strict';

const Activity = require('../activities/Activity');

function Gateway() {
  Activity.apply(this, arguments);
  this.join = this.inbound.length > 1;
  this.pendingJoin = !this.join;
  this.pendingLength = 0;
}

Gateway.prototype = Object.create(Activity.prototype);

Gateway.prototype.run = function() {
  this.enter();
};

Gateway.prototype.onInbound = function(flow, rootFlow) {
  if (flow.discarded) {
    this._debug(`<${this.id}>`, `<${flow.id}> discarded`);
    return this.runInbound(flow, rootFlow);
  }

  this._debug(`<${this.id}>`, `<${flow.id}> taken`);
  return this.runInbound(flow, rootFlow);
};

Gateway.prototype.runInbound = function(flow, rootFlow) {
  if (!this.join) {
    Activity.prototype.run.call(this);
    return this.complete(flow, rootFlow);
  }
  return this.runJoin(flow, rootFlow);
};

Gateway.prototype.runJoin = function(takenFlow) {
  if (!this.pendingJoin) {
    Activity.prototype.run.call(this);

    this._debug(`<${this.id}>`, `join initialised from ${takenFlow.discarded ? 'discarded' : 'taken'} <${takenFlow.id}>`);
    this.pendingJoin = true;
    // Remove one since one inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    this.emit('start', this);

    return;
  }

  this.pendingLength--;
  this._debug(`<${this.id}>`, `join from ${takenFlow.discarded ? 'discarded' : 'taken'} <${takenFlow.id}> - pending ${this.pendingLength}`);
  if (this.pendingLength === 0) {
    this.complete();
  }
};

Gateway.prototype.complete = function() {
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

Gateway.prototype.resume = function(state) {

  if (state.hasOwnProperty('pendingLength')) {
    this.pendingLength = state.pendingLength;
  }
  if (state.hasOwnProperty('pendingJoin')) {
    this.pendingJoin = state.pendingJoin;
  }
  Activity.prototype.resume.apply(this, arguments);
};

Gateway.prototype.getState = function() {
  const state = Activity.prototype.getState.apply(this, arguments);

  if (this.pendingJoin) {
    state.pendingJoin = this.pendingJoin;
    state.pendingLength = this.pendingLength;
  }

  return state;
};

module.exports = Gateway;
