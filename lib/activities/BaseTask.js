'use strict';

const Activity = require('./Activity');
const util = require('util');

const internals = {};

module.exports = internals.BaseTask = function(activity, parentContext) {
  Activity.apply(this, arguments);
  this.boundEvents = parentContext.getBoundaryEvents(activity.id);
};

util.inherits(internals.BaseTask, Activity);

internals.BaseTask.prototype.run = function() {
  startBoundEvents.call(this, this.boundEvents);
  Activity.prototype.run.apply(this, arguments);
};

internals.BaseTask.prototype.complete = function(output) {
  this.teardownBoundEventListeners(true);
  this.emit('end', this, output);
  this.takeAllOutbound();
};

internals.BaseTask.prototype.cancel = function() {
  this.teardownBoundEventListeners();
  Activity.prototype.cancel.apply(this, arguments);
};

internals.BaseTask.prototype.onBoundEvent = function() {
  this.cancel();
};

internals.BaseTask.prototype.setupBoundEventListeners = function() {
  if (this._onBoundEvent) return;

  this._onBoundEvent = this.onBoundEvent.bind(this);

  this.boundEvents.forEach((def) => {
    def.on('end', this._onBoundEvent);
    def.on('cancel', this._onBoundEvent);
  });
};

internals.BaseTask.prototype.teardownBoundEventListeners = function(cancel) {
  if (!this._onBoundEvent) return;

  this.boundEvents.forEach((def) => {
    def.removeListener('end', this._onBoundEvent);
    def.removeListener('cancel', this._onBoundEvent);
    if (cancel) {
      def.cancel();
    }
  });

  delete this._onBoundEvent;
};

function startBoundEvents(boundEvents) {
  this.setupBoundEventListeners();

  boundEvents.forEach((boundEvent) => {
    boundEvent.run();
  });
}
