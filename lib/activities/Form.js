'use strict';

const debug = require('debug')('bpmn-engine:form');
const expressions = require('../expressions');

const internals = {};

module.exports = internals.Form = function(formData, parentContext) {
  this.formData = formData;
  this.parentContext = parentContext;
  this.fields = [];
};

internals.Form.prototype.init = function(message) {
  if (this.formData.formKey) {
    this.key = getFormKey.call(this, message);
  }

  if (!this.formData.fields) return;
  this.fields = initFields.call(this, message);
};

internals.Form.prototype.getFields = function() {
  return this.fields;
};

internals.Form.prototype.getState = function() {
  const state = {};
  if (this.key) {
    state.key = this.key;
  }

  if (this.formData.fields) {
    state.fields = this.formData.fields.map((field) => {
      return {
        id: field.id,
        label: field.label,
        type: field.type
      };
    });
  }

  return state;
};

function getFormKey(message) {
  if (!expressions.hasExpression(this.formData.formKey)) return this.formData.formKey;

  const contextVariables = this.parentContext.getFrozenVariablesAndServices(message);
  debug(`resolve formKey "${this.formData.formKey}" value expression`);
  return expressions(this.formData.formKey, contextVariables);
}

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
