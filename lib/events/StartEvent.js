'use strict';

const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  this.isStart = true;
  this.isStartEvent = true;
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function() {
  this.enter();
  this.emit('start', this);
  this.emit('end', this);
  this.takeAllOutbound();
};
