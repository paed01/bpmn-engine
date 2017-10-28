'use strict';

const Debug = require('debug');
const getNormalizedResult = require('./getNormalizedResult');

module.exports = function FormIo(form, {environment}) {
  const {id, type: formType} = form;
  const type = `io:${formType}`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    id,
    type,
    activate,
    resume: resumeIo
  };

  function resumeIo(parentApi, inputContext, ioState) {
    const ioApi = activate(parentApi, inputContext);
    ioApi.resume(ioState);
    return ioApi;
  }

  function activate(parentApi, inputContext) {
    let formInstance;

    const {id: activityId} = parentApi;
    const {loop, index} = inputContext;

    debug(`<${activityId}>${loop ? ` loop context iteration ${index}` : ''} activated`);

    return {
      id,
      type,
      getForm,
      getInput,
      getOutput,
      getState,
      resume,
      save,
      setOutputValue,
      setResult
    };

    function getForm() {
      if (formInstance) return formInstance;
      formInstance = form.activate(parentApi, inputContext);
      return formInstance;
    }

    function getInput() {
      return getForm().getInput();
    }

    function getOutput() {
      return getForm().getOutput();
    }

    function getState() {
      return formInstance && formInstance.getState();
    }

    function resume(ioState) {
      if (!ioState) return;
      getForm().resume(ioState.form);
    }

    function save() {
      if (!formInstance) return {};
      environment.assignResult(getOutput());
    }

    function setOutputValue(name, value) {
      getForm().setFieldValue(name, value);
    }

    function setResult(value) {
      if (value === undefined) return;

      const normalized = getNormalizedResult(value);
      const loadedForm = getForm();
      for (const key in normalized) {
        loadedForm.setFieldValue(key, normalized[key]);
      }
    }
  }
};
