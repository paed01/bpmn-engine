'use strict';

const Debug = require('debug');

module.exports = function IoSpecification(ioSpecification, parentContext) {
  const id = ioSpecification.id;
  const type = ioSpecification.$type;
  const debug = Debug(`bpmn-engine:io:${type.toLowerCase()}`);
  const dataObjects = parentContext.getDataObjects();

  const {dataInputs, dataOutputs} = ioSpecification;
  const {inputSet, outputSet} = parentContext.getActivityIOReferences(ioSpecification);

  const input = InputParameters();
  const output = OutputParameters();

  return {
    id,
    type,
    getInput,
    getOutput,
    save,
    setOutputValue,
    setResult
  };

  function getInput() {
    debug(`<${id}> get input`);
    return input.get();
  }

  function getOutput() {
    debug(`<${id}> get output`);

    return output.get();
  }

  function save() {
    output.saveToEnvironment();
  }

  function setResult(value) {
    output.set(value);
  }

  function setOutputValue(name, value) {
    output.setValue(name, value);
  }

  function InputParameters() {
    const parms = init();

    return {
      get
    };

    function get() {
      return parms.reduce((result, {name, getInputValue}) => {
        const invalue = getInputValue();
        if (invalue !== undefined) {
          result[name] = invalue;
        }
        return result;
      }, {});
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
      if (parms.length === 1) parms[0].set(value);
      if (!value || !value.hasOwnProperty) return;

      for (const key in value) {
        setValue(key, value[key]);
      }
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
};

function DataReference(parm, dataObjects) {
  const {id, $type: type, name} = parm;
  let resultData;

  return {
    id,
    type,
    name,
    save,
    getInputValue,
    set,
    get
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
