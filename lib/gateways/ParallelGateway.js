'use strict';

const debug = require('debug')('bpmn-engine:gateway:parallelGateway');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  this.join = this.inbound.length > 1;
  this.pendingJoin = !this.join;
  this.pendingLength = 0;
  debug(`<${this.id}>`, 'init', this.join ? 'joining' : '');
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function(variables, takenFlow) {
  this.entered = true;

  if (this.join) return this.runJoin(variables, takenFlow);

  this.enter();
  debug(`<${this.id}>`, 'run');

  this.emit('start', this);
  this.complete(variables);
};

internals.Activity.prototype.cancel = function(variables, sourceFlow) {
  this.run(variables, sourceFlow);
};

internals.Activity.prototype.runJoin = function(variables, takenFlow) {
  if (!this.pendingJoin) {
    this.enter();

    debug(`<${this.id}>`, `join initialised from ${takenFlow.discarded ? 'discarded' : 'taken'} <${takenFlow.id}>`);
    this.pendingJoin = true;
    this.emit('start', this);

    // Remove one since one inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    return;
  }

  this.pendingLength--;
  debug(`<${this.id}>`, `join from ${takenFlow.discarded ? 'discarded' : 'taken'} <${takenFlow.id}> - pending ${this.pendingLength}`);
  if (this.pendingLength === 0) {
    this.complete(variables);
  }
};

internals.Activity.prototype.complete = function(variables) {
  this.pendingJoin = false;
  this.entered = false;

  this.emit('end', this);

  const atLeastOneTaken = this.inbound.some((flow) => flow.taken);
  if (!atLeastOneTaken) {
    debug(`<${this.id}>`, 'was discarded');
    return this.discardAllOutbound(variables);
  }

  debug(`<${this.id}>`, 'join completed');
  return this.takeAllOutbound(variables);
};
