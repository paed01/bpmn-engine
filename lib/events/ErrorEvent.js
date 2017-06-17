'use strict';

const EventDefinition = require('../activities/EventDefinition');

function ErrorEventDefinition() {
  EventDefinition.apply(this, arguments);
}

ErrorEventDefinition.prototype = Object.create(EventDefinition.prototype);

module.exports = ErrorEventDefinition;

ErrorEventDefinition.prototype.onAttachedError = function(err, sourceActivity) {
  if (sourceActivity) {
    this._debug(`<${this.id}> error from <${sourceActivity.id}> caught:`, err.message);
  }

  const output = getErrorCodeAndMessage.call(this, err);

  EventDefinition.prototype.complete.call(this, output);
};

function getErrorCodeAndMessage(err) {
  const result = {};

  if (err.message && this.eventDefinition.errorMessageVariable) {
    this.saveToVariables = true;
    result[this.eventDefinition.errorMessageVariable] = err.message;
  }

  if (err.code && this.eventDefinition.errorCodeVariable) {
    this.saveToVariables = true;
    result[this.eventDefinition.errorCodeVariable] = err.code;
  }

  if (!this.saveToVariables) return;

  return result;
}
