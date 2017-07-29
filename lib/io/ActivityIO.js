'use strict';

const Debug = require('debug');

module.exports = function ActivityIO(activity, parentContext) {
  const id = activity.id;
  const type = `io:${activity.$type}`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const environment = parentContext.environment;

  let resultData;

  return {
    id,
    type,
    getInput,
    getOutput,
    save,
    setResult
  };

  function getInput() {
    debug(`<${id}> get input`);
    return environment.getVariablesAndServices();
  }

  function getOutput() {
    debug(`<${id}> get output`);
    return resultData;
  }

  function save() {
    environment.assignTaskInput(id, resultData);
  }

  function setResult(value) {
    resultData = value;
  }
};
