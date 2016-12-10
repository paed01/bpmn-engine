'use strict';

const EventDefinition = require('../activities/EventDefinition');

const internals = {};

module.exports = internals.MessageEvent = function() {
  EventDefinition.apply(this, arguments);
};

internals.MessageEvent.prototype = Object.create(EventDefinition.prototype);

internals.MessageEvent.prototype.signal = function(message) {
  this.message = message;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled');
  this.complete(message);
};
