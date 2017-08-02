'use strict';

const Debug = require('debug');

module.exports = function ActivityIO(activity, parentContext) {
  const id = activity.id;
  const type = `io:${activity.$type}`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const environment = parentContext.environment;
  const resultVariable = activity.resultVariable;

  const saveToOutput = activity.$type === 'bpmn:StartEvent';

  let resultData;

  return {
    id,
    isDefault: true,
    type,
    getInput,
    getOutput,
    save,
    setResult
  };

  function getInput(message) {
    debug(`<${id}> default get input`);
    return message;
  }

  function getOutput() {
    debug(`<${id}> default get output`);
    return resultData;
  }

  function save() {
    if (resultVariable) return environment.setOutputValue(resultVariable, resultData);
    if (saveToOutput) return environment.assignResult(resultData);
    environment.assignTaskInput(id, resultData);
  }

  function setResult(value) {
    resultData = value;
  }
};
