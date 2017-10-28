'use strict';

const Debug = require('debug');
const getNormalizedResult = require('./getNormalizedResult');

module.exports = function ElementPropertyIo(activityElement, {environment}, form) {
  const {id, $type} = activityElement;
  const type = `${$type}:elementio`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const outputParameters = [];

  return {
    id,
    type,
    activate,
    addOutputParameter,
    getInfo,
    resume: resumeIo
  };

  function addOutputParameter(propertyName, name) {
    const outputParm = {
      propertyName,
      name,
      activate: activateParm
    };

    outputParameters.push(outputParm);
    return outputParm;

    function activateParm(inputContext) {
      const outputName = environment.resolveExpression(name, inputContext);
      let value;

      return {
        name: outputName,
        propertyName,
        get,
        save,
        set,
      };

      function get() {
        return value;
      }
      function set(setVal) {
        value = setVal;
      }
      function save() {
        environment.setOutputValue(outputName, value);
      }
    }
  }

  function getInfo() {
    return {
      id,
      type,
      output: outputParameters
    };
  }

  function resumeIo(parentApi, inputContext, ioState) {
    return activate(parentApi, inputContext).resume(ioState);
  }

  function activate(parentApi, inputContext) {
    const {isLoopContext, index} = inputContext;

    let activatedOutputParameters, formInstance, resultData;

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
      const result = {};

      const parms = getOutputParameters();
      parms.forEach((p) => {
        result[p.name] = p.get();
      });

      return result;
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
      const parms = getOutputParameters();
      parms.forEach((p) => p.save());
    }

    function setOutputValue(name, value) {
      const parm = getOutputParm(name);
      if (parm) parm.set(value);
    }

    function setResult(result1, ...args) {
      if (args.length) {
        resultData = [result1, ...args];
      } else {
        resultData = result1;
      }
      const normalizedResult = getNormalizedResult(resultData);
      for (const key in normalizedResult) {
        setOutputValue(key, normalizedResult[key]);
      }
    }

    function getOutputParm(name) {
      const parms = getOutputParameters();
      return parms.find(({propertyName}) => propertyName === name);
    }

    function getOutputParameters(reassign) {
      if (!reassign && activatedOutputParameters) return activatedOutputParameters;
      activatedOutputParameters = outputParameters.map((p) => p.activate(inputContext));
      return activatedOutputParameters;
    }
  }
};
