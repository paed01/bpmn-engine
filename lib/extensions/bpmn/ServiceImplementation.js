'use strict';

const Debug = require('debug');

module.exports = function ServiceImplementation(activityElement, parentContext) {
  const {id, $type, implementation} = activityElement;
  const type = `${$type}:implementation`;
  const {environment} = parentContext;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    type,
    implementation,
    activate,
  };

  function activate(parentApi, inputContext) {
    const {isLoopContext, index} = inputContext;

    debug(`<${id}> service${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    const serviceFn = environment.resolveExpression(implementation, inputContext);
    return {
      type,
      execute
    };

    function execute(inputArg, callback) {
      if (typeof serviceFn !== 'function') return callback(new Error(`Implementation ${implementation} did not resolve to a function`));

      serviceFn.call(parentApi, inputArg, (err, ...args) => {
        callback(err, args);
      });
    }
  }
};
