'use strict';

const Activity = require('../activities/Activity');

function ParallelGateway() {
  Activity.apply(this, arguments);
  this.join = this.inbound.length > 1;
  this.fork = this.outbound.length > 1;
}

ParallelGateway.prototype = Object.create(Activity.prototype);

ParallelGateway.prototype.run = function() {
  init.call(this);
  continueRun.call(this);
};

function init() {
  if (this.join) {
    if (!this.pendingInbound) {
      this.pendingInbound = this.inbound.slice();
    }
    this.pendingJoin = true;
  }

  if (this.fork) {
    if (!this.pendingOutbound) {
      this.pendingOutbound = this.outbound.slice();
    }
    this.pendingFork = true;
  }

  if (!this.discardedInbound) {
    this.discardedInbound = [];
  }

  this.taken = false;
  Activity.prototype.run.call(this);
}

ParallelGateway.prototype.activate = function() {
  Activity.prototype.activate.apply(this, arguments);

  this._onOutbound = this.onOutbound.bind(this);
  this.outbound.forEach((flow) => {
    flow.on('taken', this._onOutbound);
    flow.on('discarded', this._onOutbound);
  });
};

ParallelGateway.prototype.deactivate = function() {
  Activity.prototype.deactivate.apply(this, arguments);
  this.outbound.forEach((flow) => {
    flow.removeListener('taken', this._onOutbound);
    flow.removeListener('discarded', this._onOutbound);
  });
};

ParallelGateway.prototype.onInbound = function(flow, rootFlow) {
  if (!this.discardedInbound) {
    init.call(this);
  }

  if (this.join) {
    return runOnJoinInbound.call(this, flow, rootFlow);
  }

  return runOnInbound.call(this, flow, rootFlow);
};

function runOnJoinInbound(flow, rootFlow) {
  if (flow.discarded) {
    this.discardedInbound.push(flow);
  }

  const pendingIndex = this.pendingInbound.indexOf(flow);
  this.pendingInbound.splice(pendingIndex, 1);

  this._debug(`<${this.id}> join from ${flow.discarded ? 'discarded' : 'taken'} <${flow.id}> - pending ${this.pendingInbound.length}`);

  if (this.pendingInbound.length === 0) {
    this.pendingJoin = false;
    return continueRun.call(this, rootFlow);
  }

  if (this.inbound.length - this.pendingInbound.length === 1) {
    this.taken = true;
    this.emit('start', this);
  }
}

function runOnInbound(flow, rootFlow) {
  if (flow.discarded) {
    this.discardedInbound.push(flow);
  }
  return continueRun.call(this, rootFlow);
}


function continueRun(rootFlow) {
  if (this.pendingJoin) return;

  if (allInboundDiscarded.call(this)) {
    return this.outbound.forEach((f) => f.discard(rootFlow));
  }

  if (this.pendingFork) {
    return this.pendingOutbound.forEach((f) => f.take(rootFlow));
  } else if (!this.isEnd) {
    return this.outbound.forEach((f) => f.take(rootFlow));
  }

  this.complete();
}

ParallelGateway.prototype.onOutbound = function(flow) {
  if (!this.pendingOutbound) return this.complete();

  const idx = this.pendingOutbound.indexOf(flow);
  this.pendingOutbound.splice(idx, 1);
  this._debug(`<${this.id}> outbound flow <${flow.id}> ${flow.discarded ? 'discarded' : 'taken'} (${this.pendingOutbound.length})`);

  if (!this.taken) {
    this.taken = true;
    this.emit('start', this);
  }

  if (this.pendingOutbound.length === 0) {
    this._debug(`<${this.id}> all pending outbound completed`);
    this.complete();
  }
};

ParallelGateway.prototype.complete = function() {
  const discard = allInboundDiscarded.call(this);

  delete this.pendingInbound;
  delete this.pendingOutbound;
  delete this.discardedInbound;
  this.pendingJoin = false;
  this.pendingFork = false;

  if (discard) {
    this._debug(`<${this.id}>`, 'was discarded');
  } else {
    this.emit('end', this);
  }

  this.leave();
};

ParallelGateway.prototype.resume = function(state) {
  if (state.hasOwnProperty('pendingJoin')) {
    this.pendingJoin = state.pendingJoin;
  }

  if (state.pendingInbound) {
    this.pendingInbound = state.pendingInbound.map((flowId) => this.inbound.find((flow) => flow.id === flowId));
  }
  if (state.discardedInbound) {
    this.discardedInbound = state.discardedInbound.map((flowId) => this.inbound.find((flow) => flow.id === flowId));
  }
  if (state.pendingOutbound) {
    this.pendingOutbound = state.pendingOutbound.map((flowId) => this.outbound.find((flow) => flow.id === flowId));
  }

  Activity.prototype.resume.apply(this, arguments);
};

ParallelGateway.prototype.getState = function() {
  const state = Activity.prototype.getState.apply(this, arguments);

  if (this.pendingJoin) {
    state.pendingJoin = this.pendingJoin;
  }
  if (this.pendingInbound) {
    state.pendingInbound = this.pendingInbound.map((flow) => flow.id);
  }
  if (this.discardedInbound) {
    state.discardedInbound = this.discardedInbound.map((flow) => flow.id);
  }

  if (this.pendingOutbound) {
    state.pendingOutbound = this.pendingOutbound.map((flow) => flow.id);
  }

  return state;
};

function allInboundDiscarded() {
  if (this.isStart) return false;
  return this.inbound.length === this.discardedInbound.length;
}

module.exports = ParallelGateway;
