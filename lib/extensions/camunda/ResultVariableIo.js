'use strict';

const Debug = require('debug');
const getNormalizedResult = require('./getNormalizedResult');
const {hasExpression} = require('./utils');

module.exports = function ResultVariableIo(activityElement, {environment}, form) {
  const {id, $type, resultVariable} = activityElement;
  const type = `${$type}:resultvariable`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    id,
    type,
    activate,
    resume: resumeIo
  };

  function resumeIo(parentApi, inputContext, ioState) {
    return activate(parentApi, inputContext).resume(ioState);
  }

  function activate(parentApi, inputContext) {
    const {isLoopContext, index} = inputContext;
    const isExpression = hasExpression(resultVariable);

    let formInstance, variableName, resultData;

    debug(`<${id}>${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    const ioApi = {
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

    return ioApi;

    function getForm() {
      if (!form) return;
      if (formInstance) return formInstance;
      formInstance = form.activate(parentApi, inputContext);
      return formInstance;
    }

    function getInput() {
      return inputContext;
    }

    function getOutput() {
      if (isLoopContext) {
        if (formInstance) return formInstance.getOutput();
        return resultData;
      }

      return formInstance ? formInstance.getOutput() : resultData;
    }

    function getState() {
      const result = {};
      if (formInstance) {
        Object.assign(result, formInstance.getState());
      }
      return result;
    }

    function resume(ioState) {
      if (!ioState) return ioApi;

      const ioForm = getForm();
      if (ioForm) ioForm.resume(ioState.form);

      return ioApi;
    }

    function save() {
      const name = getVariableName(true);
      const value = formInstance ? formInstance.getOutput() : resultData;
      if (!name || value === undefined) return;

      environment.setOutputValue(name, value);
    }

    function setOutputValue(name, value) {
      resultData = resultData || {};
      resultData[name] = value;
    }

    function setResult(result1, ...args) {
      if (args.length) {
        resultData = [result1, ...args];
      } else {
        resultData = result1;
      }
    }

    function getOutputContext() {
      return Object.assign(inputContext, getNormalizedResult(resultData || {}));
    }

    function getVariableName(reassign) {
      if (!reassign && variableName) return variableName;
      if (isExpression) {
        variableName = environment.resolveExpression(resultVariable, getOutputContext());
      } else {
        variableName = resultVariable;
      }

      return variableName;
    }
  }
};
