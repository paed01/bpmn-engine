'use strict';

const EventDefinition = require('../activities/EventDefinition');

const internals = {};

module.exports = internals.ErrorEventDefinition = function() {
  EventDefinition.apply(this, arguments);
};

internals.ErrorEventDefinition.prototype = Object.create(EventDefinition.prototype);

internals.ErrorEventDefinition.prototype.onAttachedError = function(err) {
  this._debug(`<${this.id}>`, 'error caught:', err.message);
  EventDefinition.prototype.complete.call(this);
};
