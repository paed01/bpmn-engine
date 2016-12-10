'use strict';

const contextHelper = require('../context-helper');
const Activity = require('../activities/Activity');

const internals = {};

module.exports = internals.Event = function() {
  Activity.apply(this, arguments);
  this.isEnd = true;
  this.taken = false;
  this.terminate = contextHelper.isTerminationElement(this.activity);
};

internals.Event.prototype = Object.create(Activity.prototype);

internals.Event.prototype.run = function() {
  Activity.prototype.run.call(this);
  this.taken = true;
  this.emit('end', this);
  this.leave();
};
