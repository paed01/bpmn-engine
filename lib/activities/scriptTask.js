'use strict';

const debug = require('debug')('bpmn-engine:activity:scriptTask');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  debug('init', activity.id);

  this.activity = activity;
  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  debug('take', this.activity.id);
  this.emit('start', this);

  this.executeScript(variables, (err) => {
    if (err) return this.emit('error', err);

    this.emit('end', this);
    takeAll.call(this, this.outbound, variables);
  });
};

internals.Activity.prototype.executeScript = function(variables, callback) {
  const script = new vm.Script(this.activity.script, {
    filename: `${this.activity.id}.script`
  });

  const context = new vm.createContext({
    context: variables,
    request: require('request'),
    next: callback
  });

  const result = script.runInContext(context);
  debug(`condition result ${this.activity.id} evaluated to ${result}`);
  return result;
};

function takeAll(outbound, variables) {
  debug(`take all ${this.activity.id} ${outbound.length} sequence flows`);
  outbound.forEach(take.bind(this, variables));
}

function take(variables, outboundSequenceFlow) {
  outboundSequenceFlow.take(variables);
}
