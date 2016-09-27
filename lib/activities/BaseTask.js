'use strict';

const Activity = require('./Activity');
const util = require('util');

const internals = {};

module.exports = internals.BaseTask = function() {
  Activity.apply(this, arguments);
};

util.inherits(internals.BaseTask, Activity);

internals.BaseTask.prototype.complete = function(output) {
  this.emit('end', this, output);
  this.takeAllOutbound(this.getOutput(this.getInput(output)));
};
