'use strict';

const expressions = require('./expressions');
const Path = require('path');

module.exports = function Environment(options) {
  options = options || {};

  const initialOptions = extractOptions(options);
  const initialOutput = options.output || {};
  const initialVariables = options.variables || {};
  const serviceDefinitions = options.services || {};

  const services = getServices();

  return init(initialOptions, initialVariables, initialOutput);

  function init(clonedOptions, variables, output) {
    return {
      output,
      services,
      variables,
      addService,
      assignResult,
      assignTaskInput,
      assignVariables,
      clone,
      getServiceByName,
      getState,
      getVariablesAndServices,
      resolveExpression
    };

    function getVariablesAndServices(override, freezeVariablesAndService) {
      const result = Object.assign({
        output
      }, clonedOptions, override);

      if (freezeVariablesAndService) {
        result.services = Object.freeze(Object.assign({}, services));
        result.variables = Object.freeze(Object.assign({}, variables));
      } else {
        result.services = services;
        result.variables = variables;
      }

      return result;
    }

    function clone(overrideOptions, newOutput) {
      const newOptions = Object.assign({}, initialOptions, extractOptions(overrideOptions));
      return init(newOptions, variables, newOutput || {});
    }

    function assignTaskInput(taskId, result) {
      if (!result || !taskId) return;
      output.taskInput = output.taskInput || {};
      variables.taskInput = variables.taskInput || {};

      output.taskInput[taskId] = result;
      variables.taskInput[taskId] = result;
    }

    function assignResult(result) {
      if (!result) return;
      const clonedResult = Object.assign({}, result);
      const taskInput = clonedResult.taskInput;
      delete clonedResult.taskInput;

      Object.assign(output, clonedResult);
      Object.assign(variables, clonedResult);

      if (taskInput) {
        Object.keys(taskInput).forEach((key) => {
          assignTaskInput(key, taskInput[key]);
        });
      }
    }

    function assignVariables(result) {
      if (!result) return;
      const clonedResult = Object.assign({}, result);
      delete clonedResult.taskInput;

      Object.assign(variables, clonedResult);
    }

    function getServiceByName(serviceName) {
      const serviceDef = services[serviceName];
      if (!serviceDef) return;
      return getService(serviceDef);
    }

    function getState() {
      return JSON.parse(JSON.stringify(options));
    }

    function resolveExpression(expression, message) {
      const from = Object.assign({
        output,
        variables,
        services
      }, message);

      return expressions(expression, from);
    }
  }

  function addService(name, serviceDef) {
    services[name] = getService(serviceDef);
  }

  function getServices() {
    return Object.keys(serviceDefinitions).reduce((result, serviceName) => {
      const serviceDef = serviceDefinitions[serviceName];
      result[serviceName] = getService(serviceDef);
      return result;
    }, {});
  }

  function extractOptions(input) {
    const copy = Object.assign({}, input);
    delete copy.variables;
    delete copy.services;
    delete copy.output;
    return copy;
  }
};

function getService(serviceDef) {
  let module;
  if (typeof serviceDef === 'function') {
    return serviceDef;
  } else if (!serviceDef.module) {
    return module;
  } else if (!serviceDef.type || serviceDef.type === 'require') {
    module = require(getRelativePath(serviceDef.module));
  } else { // global
    module = serviceDef.module === 'require' ? require : getGlobalService(serviceDef.module);
  }

  if (serviceDef.fnName) {
    module = module[serviceDef.fnName];
  }

  return module;
}

function getGlobalService(serviceModule) {
  return global[serviceModule];
}

function getRelativePath(module) {
  if (!module.startsWith('.')) return module;
  return Path.relative(__dirname, Path.join(process.cwd(), module));
}
