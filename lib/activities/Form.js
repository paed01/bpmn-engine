'use strict';

const debug = require('debug')('bpmn-engine:form');
const expressions = require('../expressions');

function Form(formData) {
  this.formData = formData;
  this.fields = [];
}

Form.prototype.init = function(message, environment) {
  if (this.formData.formKey) {
    this.key = getFormKey.call(this, message, environment.getVariablesAndServices());
  }

  if (!this.formData.fields) return;
  this.fields = initFields.call(this, message, environment.getVariablesAndServices());
};

Form.prototype.getFields = function() {
  return this.fields;
};

Form.prototype.getState = function() {
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

function getFormKey(message, contextVariables) {
  if (!expressions.hasExpression(this.formData.formKey)) return this.formData.formKey;
  debug(`resolve formKey "${this.formData.formKey}" value expression`);
  return expressions(this.formData.formKey, contextVariables);
}

function initFields(message, contextVariables) {
  return this.formData.fields.map((formField) => {
    const field = Object.assign({}, formField);

    if (expressions.hasExpression(field.id)) {
      debug(`resolve field name <${field.id}> expression`);
      field.id = expressions(field.id, message, contextVariables);
    }

    if (expressions.hasExpression(field.defaultValue)) {
      debug(`resolve field <${field.id}> default value expression`);
      field.defaultValue = expressions(field.defaultValue, message, contextVariables);
    }

    return field;
  });
}

module.exports = Form;
