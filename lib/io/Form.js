'use strict';

const Debug = require('debug');
const expressions = require('../expressions');

module.exports = function Form(formData, {environment}) {
  const formFields = formData.fields;
  if (!formFields || !formFields.length) return;

  const type = formData.$type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    type,
    activate,
    resume: (state) => activate().resume(state)
  };

  function activate(contextInput) {
    contextInput = contextInput || environment.getFrozenVariablesAndServices();
    debug('load fields', formFields.length, contextInput);
    const fields = formFields.map((formField) => FormField(formField, contextInput));

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
  }

  function FormField(formField, contextInput) {
    const id = formField.id;
    const fieldType = formField.$type;
    const valueType = formField.type;

    const label = getLabel();
    const defaultValue = getDefaultValue();

    let assigned, value;

    const fieldApi = {
      id,
      type: fieldType,
      label,
      valueType,
      defaultValue,
      get,
      getState,
      reset,
      resume,
      set
    };

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

    function getLabel() {
      if (expressions.hasExpression(formField.label)) {
        debug(`resolve field <${id}> label expression`);
        return expressions(formField.label, contextInput);
      }
      return formField.label;
    }

    function getDefaultValue() {
      if (expressions.hasExpression(formField.defaultValue)) {
        debug(`resolve field <${id}> default value expression`, contextInput);
        return expressions(formField.defaultValue, contextInput);
      }

      return formField.defaultValue;
    }

    function resume(state) {
      fieldApi.label = state.label;
      fieldApi.defaultValue = state.defaultValue;
      if (state.hasOwnProperty('value')) set(state.value);
    }
  }
};
