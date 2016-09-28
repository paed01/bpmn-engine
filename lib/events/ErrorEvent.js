'use strict';

const EventDefinition = require('../activities/EventDefinition');
const util = require('util');

const internals = {};

module.exports = internals.ErrorEventDefinition = function() {
  EventDefinition.apply(this, arguments);
};

util.inherits(internals.ErrorEventDefinition, EventDefinition);

internals.ErrorEventDefinition.prototype.run = function() {
  EventDefinition.prototype.run.call(this);
};

internals.ErrorEventDefinition.prototype.onAttachedError = function() {
  EventDefinition.prototype.completed.call(this);
};
