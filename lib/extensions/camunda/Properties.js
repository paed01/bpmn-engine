'use strict';

const Debug = require('debug');
const Parameter = require('./Parameter');

module.exports = function Properties(properties, parentContext) {
  const {$type: type, values} = properties;

  if (!values) return;

  const {environment} = parentContext;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const parameters = values.map((parm) => Parameter(parm, environment));

  return {
    type,
    activate,
    getProperty
  };

  function activate(parentApi, inputContext) {
    const {id: activityId} = parentApi;
    const {isLoopContext, index} = inputContext;

    debug(`<${activityId}> service${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    let activeParameters;
    let propertyValues;

    return {
      type,
      get,
      getPropertyValue
    };

    function get() {
      if (propertyValues) return propertyValues;
      propertyValues = {};
      return getParameters().reduce((result, parm) => {
        const value = parm.get();
        if (value !== undefined) {
          result[parm.name] = value;
        }
        return result;
      }, propertyValues);
    }

    function getPropertyValue(name) {
      if (propertyValues) return propertyValues[name];

      const prop = getParameters().find((parm) => parm.name === name);
      return prop && prop.get();
    }

    function getParameters() {
      if (activeParameters) return activeParameters;
      activeParameters = parameters.map((parm) => parm.activate(inputContext));
      return activeParameters;
    }
  }

  function getProperty(name) {
    return parameters.find((parm) => parm.name === name);
  }
};
