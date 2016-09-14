'use strict';

const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  Activity.apply(this, arguments);
  this.boundEvents = parent.getBoundaryEvents(activity.id);
};

util.inherits(internals.Task, Activity);

internals.Task.prototype.run = function(variables) {
  startBoundEvents.call(this, this.boundEvents, variables);
  Activity.prototype.run.apply(this, arguments);
};

internals.Task.prototype.complete = function(output, variables) {
  this.teardownBoundEventListeners();
  this.emit('end', this, output);
  this.takeAllOutbound(variables);
};

internals.Task.prototype.cancel = function() {
  this.teardownBoundEventListeners();
  Activity.prototype.cancel.apply(this, arguments);
};

internals.Task.prototype.onBoundEvent = function() {
  this.cancel();
};

internals.Task.prototype.setupBoundEventListeners = function() {
  if (this._onBoundEvent) return;

  this._onBoundEvent = this.onBoundEvent.bind(this);

  this.boundEvents.forEach((def) => {
    def.on('end', this._onBoundEvent);
    def.on('cancel', this._onBoundEvent);
  });
};

internals.Task.prototype.teardownBoundEventListeners = function() {
  if (!this._onBoundEvent) return;

  this.boundEvents.forEach((def) => {
    def.removeListener('end', this._onBoundEvent);
    def.removeListener('cancel', this._onBoundEvent);
  });

  delete this._onBoundEvent;
};

function startBoundEvents(boundEvents, variables) {
  this.setupBoundEventListeners();

  boundEvents.forEach((boundEvent) => {
    boundEvent.run(variables);
  });
}
