'use strict';

const debug = require('debug')('bpmn-engine:activity:sequenceFlow');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  debug('init', activity.element.id);

  this.id = activity.element.id;
  this.activity = activity;
  this.target = parent.getSequenceFlowTarget(activity.element.id);
  this.isDefault = parent.isDefaultSequenceFlow(activity.element.id);
  this.taken = false;
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.take = function(variables) {
  debug('take', this.activity.element.id);
  if (this.activity.element.conditionExpression) {
    this.taken = this.executeCondition(variables);
  } else {
    debug(`unconditional flow ${this.activity.element.id} taken`);
    this.taken = true;
  }

  if (this.taken) {
    this.emit('taken', this);
  } else {
    this.discard();
  }

  this.discarded = false;

  return this.taken;
};

internals.Activity.prototype.discard = function() {
  debug('discard', this.activity.element.id);
  this.discarded = true;
  this.emit('discarded', this);
};

internals.Activity.prototype.executeCondition = function(variables) {
  const script = new vm.Script(this.activity.element.conditionExpression.body, {
    filename: `${this.id}.condition`,
    displayErrors: true
  });
  const context = new vm.createContext({
    context: variables
  });
  const result = script.runInContext(context);
  debug(`condition result ${this.activity.element.id} evaluated to ${result}`);
  return result;
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;
};
