'use strict';

module.exports = function getTaskOutput(id, hasDefinedOutput, output) {
  if (hasDefinedOutput) {
    return output;
  }
  const result = {
    taskInput: {}
  };
  result.taskInput[id] = output;
  return result;
};
