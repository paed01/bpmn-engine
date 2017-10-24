'use strict';

const Debug = require('debug');
const getNormalizedResult = require('../../getNormalizedResult');

module.exports = function IoSpecification(ioSpecification, parentContext) {
  const id = ioSpecification.id;
  const type = ioSpecification.$type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const dataObjects = parentContext.getDataObjects();

  const {dataInputs, dataOutputs} = ioSpecification;
  const {inputSet, outputSet} = parentContext.getActivityIOReferences(ioSpecification);

  return {
    id,
    type,
    activate,
    resume: resumeIo
  };

  function resumeIo(parentApi, inputContext, ioState) {
    const activatedIo = activate(parentApi, inputContext);
    activatedIo.resume(ioState);
    return activatedIo;
  }

  function activate(parentApi, inputContext) {
    const input = InputParameters();
    const output = OutputParameters();

    const {id: activityId} = parentApi;
    const {index, isLoopContext, isLooped} = inputContext;

    debug(`<${activityId}>${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

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

    function getForm() {}

    function getInput() {
      return input.get();
    }

    function getOutput() {
      return output.get();
    }

    function getState() {
      const inputState = input.getState();
      if (!inputState) return;

      return {
        ioSpecification: inputState
      };
    }

    function resume(ioState) {
      input.resume(ioState.ioSpecification);
    }

    function save() {
      output.saveToEnvironment();
    }

    function setResult(...args) {
      output.set(...args);
    }

    function setOutputValue(name, value) {
      output.setValue(name, value);
    }

    function InputParameters() {
      const parms = init();
      let resumedInput;

      return {
        get,
        getState: getInputState,
        resume: resumeInput
      };

      function get() {
        if (resumedInput) return resumedInput;

        return parms.reduce((result, {name, getInputValue, hasInputReference}) => {
          let invalue;
          if (hasInputReference) {
            invalue = getInputValue();
          } else {
            invalue = inputContext[name];
          }
          if (invalue !== undefined) {
            result[name] = invalue;
          }

          return result;
        }, {});
      }

      function getInputState() {
        if (!parms.length) return;
        return {
          input: get()
        };
      }

      function resumeInput(ioSpecState) {
        if (!ioSpecState) return;
        resumedInput = Object.assign({}, ioSpecState.input);
      }

      function init() {
        if (!dataInputs) return [];
        if (!inputSet) {
          return dataInputs.map((parm) => DataReference(parm, dataObjects));
        }

        return inputSet.map((inset) => {
          return DataReference(dataInputs.find((parm) => parm.id === inset.id), dataObjects);
        });
      }
    }

    function OutputParameters() {
      const parms = init();

      return {
        get,
        saveToEnvironment,
        set,
        setValue
      };

      function set(value) {
        if (isLooped) return setLoopResult(value);
        setOutputResult(value);
      }

      function setOutputResult(value) {
        if (value === undefined) return;
        for (const key in value) {
          setValue(key, value[key]);
        }
      }

      function setLoopResult(value) {
        const perKeyResult = {};
        for (let i = 0; i < value.length; ++i) {
          const iterationValue = getNormalizedResult(value[i]);
          for (const key in iterationValue) {
            perKeyResult[key] = perKeyResult[key] || [];
            perKeyResult[key].push(iterationValue[key]);
          }
        }

        setOutputResult(perKeyResult);
      }

      function setValue(parmName, value) {
        const parm = parms.find(({name}) => name === parmName);
        if (!parm) return;
        parm.set(value);
      }

      function get() {
        return parms.reduce((result, parm) => {
          const value = parm.get();
          if (value !== undefined) {
            result[parm.id] = value;
          }
          return result;
        }, {});
      }

      function saveToEnvironment() {
        parms.forEach((parm) => {
          parm.save();
        });
      }

      function init() {
        if (!dataOutputs) return [];
        if (!outputSet) {
          return dataOutputs.map((parm) => DataReference(parm, dataObjects));
        }

        return outputSet.map((outset) => {
          return DataReference(dataOutputs.find((parm) => parm.id === outset.id), dataObjects);
        });
      }
    }

  }
};

function DataReference(parm, dataObjects) {
  const {id, $type: type, name} = parm;
  const hasInputReference = dataObjects.hasActivityInputReference(id);

  let resultData;

  return {
    id,
    type,
    name,
    hasInputReference,
    get,
    getInputValue,
    save,
    set
  };

  function getInputValue() {
    return dataObjects.getActivityInputValue(id);
  }

  function save() {
    dataObjects.saveActivityOutputValue(id, get());
  }

  function get() {
    return resultData;
  }

  function set(value) {
    resultData = value;
  }
}
