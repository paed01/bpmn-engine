'use strict';

const EventDefinition = require('../activities/EventDefinition');
const util = require('util');

const internals = {};

module.exports = internals.MessageEvent = function() {
  EventDefinition.apply(this, arguments);
};

util.inherits(internals.MessageEvent, EventDefinition);

internals.MessageEvent.prototype.signal = function(message) {
  this.message = message;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled');
  this.complete(message);
};
