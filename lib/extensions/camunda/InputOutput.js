'use strict';

const Debug = require('debug');
const getNormalizedResult = require('./getNormalizedResult');
const Parameter = require('./Parameter');

module.exports = function InputOutput(activity, {environment}, form) {
  const id = activity.id;
  const type = activity.$type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  const inputParameters = activity.inputParameters && activity.inputParameters.map((parm) => Parameter(parm, environment));
  const outputParameters = activity.outputParameters && activity.outputParameters.map((parm) => Parameter(parm, environment));

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
    const {id: activityId} = parentApi;
    const {isLoopContext, index} = inputContext;

    let formInstance, iParms, oParms, resultData;

    debug(`<${activityId}>${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

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
      formInstance = form.activate(parentApi, getInputContext());
      return formInstance;
    }

    function getInput() {
      return internalGetInput(true) || {};
    }

    function internalGetInput(returnUndefined) {
      if (!inputParameters) return;
      return getInputParameters().reduce((result, parm) => {
        const val = parm.get();
        if (val !== undefined || returnUndefined) {
          if (!result) result = {};
          result[parm.name] = val;
        }
        return result;
      }, undefined);
    }

    function getOutput() {
      if (isLoopContext) {
        if (formInstance) return formInstance.getOutput();
        return resultData;
      }

      if (!outputParameters) return;

      const result = {};

      getOutputParameters().forEach((parm) => {
        const val = parm.get();
        if (val !== undefined) {
          result[parm.name] = val;
        }
      });

      return result;
    }

    function getState() {
      const result = {};

      const inputState = internalGetInput();
      if (inputState) result.input = inputState;
      if (formInstance) {
        Object.assign(result, formInstance.getState());
      }

      return result;
    }

    function resume(ioState) {
      if (!ioState) return ioApi;

      const ioForm = getForm();
      if (ioForm) ioForm.resume(ioState.form);

      if (ioState.input) {
        getInputParameters().forEach((parm) => parm.set(ioState.input[parm.name]));
      }

      return ioApi;
    }

    function save() {
      if (!outputParameters) return;

      getOutputParameters(true).forEach((parm) => {
        parm.save();
      });
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
      return Object.assign(getInputContext(), getNormalizedResult(resultData || {}));
    }

    function getInputContext() {
      return Object.assign({}, inputContext, getInput());
    }

    function getInputParameters() {
      if (iParms) return iParms;
      if (!inputParameters) return [];
      iParms = inputParameters.map((parm) => parm.activate(inputContext));
      return iParms;
    }

    function getOutputParameters(reassign) {
      if (!outputParameters) return [];
      if (!reassign && oParms) return oParms;
      oParms = outputParameters.map((parm) => parm.activate(getOutputContext()));
      return oParms;
    }
  }
};
