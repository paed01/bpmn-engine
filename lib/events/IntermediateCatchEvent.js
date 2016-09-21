'use strict';

const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Event = function() {
  Activity.apply(this, arguments);
  this._debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Event, Activity);

internals.Event.prototype.run = function() {
  Activity.prototype.run.call(this);

  this._debug(`<${this.id}>`, 'run');

  this.emit('start', this);
  this.emit('wait', this);
};

internals.Event.prototype.signal = function(message) {
  this.message = message;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled');
  this.complete(message);
};

internals.Event.prototype.complete = function(message) {
  this.emit('end', this, message);
  this.takeAllOutbound();
};
