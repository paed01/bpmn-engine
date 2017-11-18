'use strict';

const moddleOptions = require('./js-bpmn-moddle.json');

module.exports = {
  extension: Js,
  moddleOptions
};

function Js(activityElement, parentContext) {
  const {formKey} = activityElement;

  const form = loadForm();

  return {
    form
  };

  function loadForm() {
    if (formKey) return FormKey(activityElement, parentContext);
  }
}

function FormKey(activityElement) {
  const {id, formKey} = activityElement;
  const type = 'js:formKey';

  return {
    id,
    type,
    activate
  };

  function activate() {
    return {
      id,
      type,
      getState
    };

    function getState() {
      return {
        key: formKey
      };
    }
  }

}
