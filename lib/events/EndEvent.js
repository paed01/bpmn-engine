'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:activity:endEvent');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
  this.isEnd = true;
  this.taken = false;
  this.terminate = contextHelper.isTerminationElement(activity);
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function() {
  Activity.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this.taken = true;
  setImmediate(this.emit.bind(this, 'end', this));
};
