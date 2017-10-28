'use strict';

module.exports = function FormField(formField, inputContext, environment) {
  const {id, $type: fieldType, type: valueType} = formField;
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
    return environment.resolveExpression(formField.label, inputContext);
  }

  function getDefaultValue() {
    return environment.resolveExpression(formField.defaultValue, inputContext);
  }

  function resume(state) {
    fieldApi.label = state.label;
    fieldApi.defaultValue = state.defaultValue;
    if (state.hasOwnProperty('value')) set(state.value);
  }
};
