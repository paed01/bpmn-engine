'use strict';

module.exports = function getNormalizedResult(result, nonObjectKey) {
  if (result === undefined) return undefined;

  const resultType = typeof result;
  nonObjectKey = nonObjectKey || 'result';

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
