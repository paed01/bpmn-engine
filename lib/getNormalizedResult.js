'use strict';

module.exports = function getNormalizedResult(result, nonObjectKey = 'result') {
  if (result === undefined) return result;

  const resultType = typeof result;

  if (resultType === 'object') {
    if (Array.isArray(result)) {
      return assign();
    }
    return result;
  }

  return assign();

  function assign() {
    const obj = {};
    obj[nonObjectKey] = result;
    return obj;
  }
};
