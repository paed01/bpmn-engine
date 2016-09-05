'use strict';

const debug = require('debug')('bpmn-engine:activity:exclusiveGateway');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  debug('init', activity.id);
  this.id = activity.id;
  this.activity = activity;
  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  debug('run', this.activity.id);
  this.emit('start', this);
  this.emit('end', this);

  takeAll.call(this, this.outbound, variables);
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;
};

function takeAll(outbound, variables) {
  debug(`take all <${this.activity.id}> ${outbound.length} sequence flows`);
  let taken = false;

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (taken) {
      sequenceFlow.discard();
    } else {
      taken = sequenceFlow.take(variables);
    }
  }

  if (!taken && defaultFlow) {
    debug(`take ${this.activity.id} default sequence flow <${defaultFlow.id}>`);
    defaultFlow.take();
  } else if (defaultFlow) {
    defaultFlow.discard();
  } else if (!taken) {
    this.emit('error', new Error(`No conditional flow was taken <${this.id}>`));
  }
}
