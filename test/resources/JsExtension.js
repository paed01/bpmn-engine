'use strict';

const moddleOptions = require('./js-bpmn-moddle.json');
const getNormalizedResult = require('../../lib/getNormalizedResult');
const {hasExpression} = require('../../lib/expressions');

module.exports = {
  extension: Js,
  moddleOptions
};

function Js(activityElement, parentContext) {
  const {formKey} = activityElement;

  let form = loadForm();
  const io = ResultVariableIo(activityElement, parentContext, form);
  if (io) {
    form = undefined;
  }

  return {
    form,
    io
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

function ResultVariableIo(activityElement, {environment}, form) {
  const {id, $type, result: resultVariable} = activityElement;
  if (!resultVariable) return;

  const type = `${$type}:resultvariable`;

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
    const {isLoopContext} = inputContext;
    const isExpression = hasExpression(resultVariable);

    let formInstance, variableName, resultData;

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
}
