'use strict';

const expressions = require('./expressions');
const Path = require('path');
const defaultOptions = ['extensions', 'variables', 'services', 'output', 'listener'];
const scriptHelper = require('./script-helper');

module.exports = Environment;

function Environment(options) {
  options = options || {};

  let variablesModified = false;
  let servicesModified = false;
  const initialOptions = extractOptions(options);
  const initialOutput = options.output || {};
  const initialVariables = options.variables || {};
  const serviceDefinitions = options.services || {};
  const extensions = options.extensions;

  let services;

  return init(initialOptions, options.listener, initialVariables, initialOutput);

  function init(clonedOptions, listener, variables, output) {
    return {
      extensions,
      listener,
      output,
      services,
      variables,
      addService,
      assignResult,
      assignTaskInput,
      assignVariables,
      clone,
      executeScript,
      get,
      getFrozenVariablesAndServices,
      getInput,
      getListener,
      getOutput,
      getServiceByName,
      getState,
      getVariablesAndServices,
      resolveExpression,
      resume,
      set,
      setListener,
      setOutputValue
    };

    function get(key) {
      return variables[key] || clonedOptions[key];
    }

    function set(key, value) {
      variablesModified = true;
      variables[key] = value;
    }

    function setOutputValue(key, value) {
      if (value === undefined) return;
      set(key, value);
      output[key] = value;
    }

    function getVariablesAndServices(override, freezeVariablesAndService) {

      const result = Object.assign({
        output
      }, clonedOptions, override);

      if (freezeVariablesAndService) {
        result.services = Object.freeze(Object.assign({}, getServices()));
        result.variables = Object.freeze(Object.assign({}, variables));
      } else {
        result.services = getServices();
        result.variables = variables;
      }

      return result;
    }

    function getFrozenVariablesAndServices(override) {
      return getVariablesAndServices(override, true);
    }

    function clone(overrideOptions, newOutput) {
      overrideOptions = overrideOptions || {};

      const newOptions = Object.assign({}, initialOptions, extractOptions(overrideOptions));
      return init(newOptions, overrideOptions.listener || listener, Object.assign({}, variables), newOutput || output);
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
      if (taskInput) clonedResult.taskInput = undefined;

      Object.assign(output, clonedResult);

      for (const key in clonedResult) {
        set(key, clonedResult[key]);
      }

      if (taskInput) {
        Object.keys(taskInput).forEach((key) => {
          assignTaskInput(key, taskInput[key]);
        });
      }
    }

    function assignVariables(result) {
      if (!result) return;
      const clonedResult = Object.assign({}, result);
      if (clonedResult.taskInput) clonedResult.taskInput = undefined;

      Object.assign(variables, clonedResult);
    }

    function setListener(newListener) {
      listener = newListener;
    }
    function getListener() {
      return listener;
    }

    function getServiceByName(serviceName) {
      const serviceDef = getServices()[serviceName];
      if (!serviceDef) return;
      return getService(serviceDef);
    }

    function getState(returnOnlyModifiedOptions) {
      const optionsState = JSON.parse(JSON.stringify(clonedOptions));
      const outputState = JSON.parse(JSON.stringify(output));
      optionsState.output = outputState;

      if (returnOnlyModifiedOptions) {
        if (variablesModified) {
          optionsState.variables = JSON.parse(JSON.stringify(variables));
        }
        if (servicesModified) {
          optionsState.services = JSON.parse(JSON.stringify(serviceDefinitions));
        }
        return optionsState;
      }

      optionsState.services = JSON.parse(JSON.stringify(serviceDefinitions));
      optionsState.variables = JSON.parse(JSON.stringify(variables));
      return optionsState;
    }

    function resume(state) {
      const stateOptions = Object.assign({variables, services: serviceDefinitions}, state, {extensions, listener});
      return Environment(stateOptions);
    }

    function resolveExpression(expression, message, expressionFnContext) {
      const from = Object.assign({
        output,
        variables,
        services: getServices()
      }, clonedOptions, message);

      return expressions(expression, from, expressionFnContext);
    }

    function getInput() {
      return Object.assign({}, initialOptions, {
        variables: initialVariables
      });
    }
    function getOutput() {
      return output;
    }
  }

  function addService(name, serviceDef) {
    servicesModified = true;
    serviceDefinitions[name] = Object.assign({}, serviceDef);
    getServices()[name] = getService(serviceDef);
  }

  function getServices() {
    if (services) return services;

    services = Object.keys(serviceDefinitions).reduce((result, serviceName) => {
      const serviceDef = serviceDefinitions[serviceName];
      result[serviceName] = getService(serviceDef);
      return result;
    }, {});

    return services;
  }

  function executeScript(scriptName, scriptBody, scriptContext, callback) {
    const script = scriptHelper.parse(scriptName, scriptBody);
    return scriptHelper.execute(script, scriptContext, callback);
  }
}

function extractOptions(input) {
  if (!input) return;

  const copy = {};
  for (const key in input) {
    if (defaultOptions.indexOf(key) === -1) {
      copy[key] = input[key];
    }
  }

  return copy;
}

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
