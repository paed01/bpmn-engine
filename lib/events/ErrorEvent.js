'use strict';

const errCodePattern = /^([A-Z_]+):/;
const EventDefinition = require('../activities/EventDefinition');

const internals = {};

module.exports = internals.ErrorEventDefinition = function() {
  EventDefinition.apply(this, arguments);
  this.saveToVariables = false;
  this.eventDefinition = this.parentContext.getErrorEventDefinition(this.activity);
};

internals.ErrorEventDefinition.prototype = Object.create(EventDefinition.prototype);

internals.ErrorEventDefinition.prototype.onAttachedError = function(err) {
  this._debug(`<${this.id}>`, 'error caught:', err.message);

  const output = getErrorCodeAndMessage.call(this, err);

  EventDefinition.prototype.complete.call(this, output);
};

function getErrorCodeAndMessage(err) {
  const result = {};
  const message = err.message;
  if (this.eventDefinition.errorMessageVariable) {
    this.saveToVariables = true;
    result[this.eventDefinition.errorMessageVariable] = message;
  }

  if (this.eventDefinition.errorCodeVariable) {
    const codeMatch = message.match(errCodePattern);
    if (codeMatch) {
      this.saveToVariables = true;
      result[this.eventDefinition.errorCodeVariable] = codeMatch[1];
    }
  }

  if (!this.saveToVariables) return;

  return result;
}
