'use strict';

const Debug = require('debug');
const Parameter = require('../parameter');

module.exports = function InputOutput(activity, parentContext) {
  const id = activity.id;
  const type = activity.$type;
  const debug = Debug(`bpmn-engine:io:${type.toLowerCase()}`);
  const environment = parentContext.environment;

  const input = activity.inputParameters && activity.inputParameters.map(Parameter);
  const output = activity.outputParameters && activity.outputParameters.map(Parameter);

  let resultData;

  return {
    id,
    type,
    getInput,
    getOutput,
    save,
    setOutputValue,
    setResult
  };

  function getInput(message, editableContextVariables) {
    const result = {};

    if (!input) {
      debug('no input parameters, return variables and services');
      return environment.getVariablesAndServices(message, !editableContextVariables);
    }

    debug('get input from', message || 'variables');

    const frozenVariablesAndServices = environment.getVariablesAndServices(message, false);
    input.forEach((parm) => {
      result[parm.name] = parm.getInputValue(message, frozenVariablesAndServices);
    });

    return result;
  }

  function getOutput() {
    if (!output) {
      return resultData;
    }

    const result = {};

    const frozenVariablesAndServices = environment.getFrozenVariablesAndServices(getInput());

    debug('get output');
    output.forEach((parm) => {
      result[parm.name] = parm.getOutputValue(resultData, frozenVariablesAndServices);
    });

    return result;
  }

  function save() {
    const result = getOutput();
    if (output) environment.assignResult(result);
  }

  function setOutputValue(name, value) {
    resultData = resultData || {};
    resultData[name] = value;
  }

  function setResult(value) {
    resultData = value;
  }
};

