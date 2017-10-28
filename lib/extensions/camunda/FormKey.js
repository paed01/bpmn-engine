'use strict';

const Debug = require('debug');
const FormField = require('./FormField');

module.exports = function FormKey(activityElement, {environment}) {
  const {id} = activityElement;
  const type = 'camunda:formKey';

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    id,
    type,
    activate
  };

  function activate(parentApi, inputContext) {
    const fields = [];
    const formKey = environment.resolveExpression(activityElement.formKey, inputContext);
    const {index, isLoopContext} = inputContext;

    const {id: activityId} = parentApi;
    debug(`<${activityId}>${isLoopContext ? ` loop context iteration ${index}` : ''} form key <${formKey}> activated`);

    const formApi = {
      id: formKey,
      formKey,
      type,
      activate,
      getField,
      getFields,
      getFieldValue,
      getInput,
      getOutput,
      getState,
      reset,
      resume,
      setFieldValue
    };

    return formApi;

    function getField(fieldId) {
      return internalCreateField(fieldId);
    }

    function getFields() {
      return internalGetFields().slice();
    }

    function setFieldValue(fieldId, value) {
      return internalCreateField(fieldId).set(value);
    }

    function getFieldValue(fieldId) {
      const field = getField(fieldId);
      if (field) return field.get();
    }

    function getState() {
      const fieldState = getFieldState();
      if (!fieldState.length) return {};

      return {
        form: {
          fields: fieldState
        }
      };
    }

    function getInput() {
      return internalGetFields().reduce((result, f) => {
        result[f.id] = f.get();
        return result;
      }, {});
    }

    function getOutput() {
      return fields.reduce((result, f) => {
        result[f.id] = f.get();
        return result;
      }, {});
    }

    function resume(state) {
      debug('resume');
      internalGetFields().forEach((field) => {
        const fieldState = state.fields.find(fstate => fstate.id === field.id);
        if (fieldState) field.resume(fieldState);
      });
      return formApi;
    }

    function internalCreateField(fieldId) {
      let field = fields.find((f) => f.id === fieldId);
      if (field) return field;

      field = FormField({id: fieldId, $type: `${formKey}:field`}, inputContext, environment);

      fields.push(field);

      return field;
    }

    function internalGetFields() {
      return fields;
    }

    function reset() {
      fields.splice();
    }

    function getFieldState() {
      return internalGetFields().reduce((result, f) => {
        const fieldState = f.getState();
        if (fieldState.hasOwnProperty('value')) result.push(fieldState);
        else if (fieldState.label) result.push(fieldState);
        return result;
      }, []);
    }
  }
};
