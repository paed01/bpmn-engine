'use strict';

const debug = require('debug')('bpmn-engine:form');
const expressions = require('../expressions');

const internals = {};

module.exports = internals.Form = function(formData, parentContext) {
  this.formData = formData;
  this.parentContext = parentContext;
};

internals.Form.prototype.init = function(message) {
  this.fields = initFields.call(this, message);
};

internals.Form.prototype.getFields = function() {
  return this.fields;
};

function initFields(message) {
  const contextVariables = this.parentContext.getFrozenVariablesAndServices(message);

  return this.formData.fields.map((formField) => {
    const field = Object.assign({}, formField);

    if (expressions.hasExpression(field.defaultValue)) {

      debug(`resolve field <${field.id}> default value expression`);
      field.defaultValue = expressions(field.defaultValue, contextVariables);
    }

    return field;
  });
}
