'use strict';

const debug = require('debug')('bpmn-engine:activity:startEvent');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function(variables) {
  this.enter();

  debug(`<${this.id}>`, 'run');

  this.emit('start', this);
  this.emit('end', this);

  this.takeAllOutbound(variables);
};
