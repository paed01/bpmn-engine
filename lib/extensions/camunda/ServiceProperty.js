'use strict';

const Debug = require('debug');

module.exports = function Connector(activityElement, parentContext, serviceProperty) {
  const {id, $type} = activityElement;
  const type = `${$type}:property`;
  const {environment} = parentContext;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  return {
    type,
    activate,
  };

  function activate(parentApi, inputContext) {
    const {isLoopContext, index} = inputContext;

    debug(`<${id}> service${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    const property = serviceProperty.activate(inputContext);
    const serviceFn = getServiceFn();

    return {
      type,
      execute
    };

    function execute(inputArg, callback) {
      if (typeof serviceFn !== 'function') return callback(new Error(`Property ${property.name} did not resolve to a function`));

      serviceFn.call(parentApi, inputArg, (err, ...args) => {
        callback(err, args);
      });
    }

    function getServiceFn() {
      const value = property.get();
      if (typeof value === 'function') return value;
      return environment.getServiceByName(value);
    }
  }
};
