'use strict';

const debug = require('debug')('bpmn-engine:task:userTask');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Task, Activity);

internals.Task.prototype.run = function(variables) {
  Activity.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this._variables = variables;

  this.emit('start', this);

  startBoundEvents.call(this, this.boundEvents);

  this.emit('wait', this);
};

internals.Task.prototype.signal = function(input) {
  this.dataOutput = input;
  this.taken = true;

  debug(`<${this.id}>`, 'signaled');

  this.emit('end', this, input);

  this.takeAllOutbound(this._variables);
};

internals.Task.prototype.cancel = function() {
  debug(`<${this.id}>`, 'cancel');
  Activity.prototype.cancel.apply(this, arguments);
};

function startBoundEvents(boundEvents, variables) {
  const self = this;
  boundEvents.forEach((boundEvent) => {
    debug(`<${this.id}>`, `start bound event <${boundEvent.id}>`);
    boundEvent._parentEndListener = (e) => {
      debug(`<${this.id}>`, `bound event <${e.id}> completed`);
      self.cancel(variables);
    };
    boundEvent.once('end', boundEvent._parentEndListener);
    boundEvent.run(variables);
  });
}
