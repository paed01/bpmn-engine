'use strict';

const debug = require('debug')('bpmn-engine:io:form');
const expressions = require('../expressions');

module.exports = function Form(formData, variableContext) {
  const type = formData.$type;
  const formFields = formData.fields;
  const fields = loadFields();

  return {
    type,
    activate,
    getField,
    getFields,
    getOutput,
    getState,
    resume,
    setFieldValue
  };

  function getField(fieldId) {
    if (!fields) return;
    return fields.find((f) => f.id === fieldId);
  }

  function getFields() {
    return fields.slice();
  }

  function setFieldValue(fieldId, value) {
    const field = getField(fieldId);
    if (!field) return false;
    return field.set(value);
  }

  function getState() {
    const result = {};

    if (!fields) return result;
    result.fields = fields.map((f) => f.getState());
    return result;
  }

  function getOutput() {
    if (!fields) return;
    return fields.reduce((result, f) => {
      result[f.id] = f.get();
      return result;
    }, {});
  }

  function resume(state) {
    debug('resume');
    state.fields.forEach((fstate) => {
      const field = getField(fstate.id);
      if (field) field.resume(fstate);
    });
  }

  function activate(activeVariableContext) {
    return Form(formData, activeVariableContext);
  }

  function loadFields() {
    debug('load fields', formFields.length);
    if (!formFields) return;
    return formFields.map((formField) => FormField(formField, variableContext));
  }
};

function FormField(formField, variableContext) {
  const id = formField.id;
  const type = formField.$type;
  const valueType = formField.type;

  let label = formField.label;
  let defaultValue = formField.defaultValue;

  let assigned, value;

  const fieldApi = {
    id,
    label,
    type,
    valueType,
    defaultValue,
    get,
    getState,
    reset,
    activate,
    resume,
    set
  };

  if (variableContext) {
    activate(variableContext);
  }

  return fieldApi;

  function set(setValue) {
    assigned = true;
    value = setValue;
    return assigned;
  }

  function reset() {
    assigned = false;
  }

  function get() {
    if (assigned) return value;
    return defaultValue;
  }

  function getState() {
    const result = {
      id,
      label,
      valueType
    };

    if (defaultValue !== undefined) {
      result.defaultValue = defaultValue;
    }

    if (assigned) {
      result.value = value;
    }

    return result;
  }

  function activate(context) {
    fieldApi.label = label = getLabel(context);
    fieldApi.defaultValue = defaultValue = getDefaultValue(context);

    function getLabel() {
      if (expressions.hasExpression(formField.label)) {
        debug(`resolve field <${id}> label expression`);
        return expressions(formField.label, context);
      }
      return formField.label;
    }

    function getDefaultValue() {
      if (expressions.hasExpression(formField.defaultValue)) {
        debug(`resolve field <${id}> default value expression`);
        return expressions(formField.defaultValue, variableContext);
      }

      return formField.defaultValue;
    }
  }

  function resume(state) {
    fieldApi.label = label = state.label;
    fieldApi.defaultValue = defaultValue = state.defaultValue;
    if (state.hasOwnProperty('value')) set(state.value);
  }
}
