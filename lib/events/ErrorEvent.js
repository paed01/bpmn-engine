'use strict';

const EventDefinition = require('../activities/EventDefinition');
const util = require('util');

const internals = {};

module.exports = internals.ErrorEventDefinition = function() {
  EventDefinition.apply(this, arguments);
};

util.inherits(internals.ErrorEventDefinition, EventDefinition);

internals.ErrorEventDefinition.prototype.onAttachedError = function() {
  EventDefinition.prototype.complete.call(this);
};
