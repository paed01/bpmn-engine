'use strict';

const EventDefinition = require('../activities/EventDefinition');
const util = require('util');

const internals = {};

module.exports = internals.ErrorEventDefinition = function() {
  EventDefinition.apply(this, arguments);
};

util.inherits(internals.ErrorEventDefinition, EventDefinition);

internals.ErrorEventDefinition.prototype.onAttachedError = function(err) {
  this._debug(`<${this.id}>`, 'error caught:', err.message);
  EventDefinition.prototype.complete.call(this);
};
