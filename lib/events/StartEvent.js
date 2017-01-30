'use strict';

const Activity = require('../activities/Activity');

const internals = {};

module.exports = internals.StartEvent = function(activity, parent) {
  Activity.call(this, activity, parent);
  this.isStart = true;
  this.isStartEvent = true;

  delete this.io;
};

internals.StartEvent.prototype = Object.create(Activity.prototype);

internals.StartEvent.prototype.run = function() {
  this.enter();
  this.emit('start', this);
  this.emit('end', this);
  this.takeAllOutbound();
};
