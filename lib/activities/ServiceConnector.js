'use strict';

const debug = require('debug')('bpmn-engine:service');
const Parameter = require('../parameter');

module.exports = function ServiceConnector(connector, parentContext) {
  const type = connector.$type || 'string';
  const name = connector.connectorId || connector.name;
  let inputParameters, outputParameters;

  if (connector.inputOutput) {
    if (connector.inputOutput.inputParameters) {
      inputParameters = connector.inputOutput.inputParameters.map(formatParameter);
    }
    if (connector.inputOutput.outputParameters) {
      outputParameters = connector.inputOutput.outputParameters.map(formatParameter);
    }
  }

  debug(`<${name}> type`, type);

  const connectorApi = {
    type,
    name,
    execute
  };

  return connectorApi;

  function execute(executeOnBehalfOf, message, callback) {
    const executeArgs = getInputArguments(message);

    function serviceCallback(err, ...args) {
      const output = getOutput(args);

      if (err) {
        debug(`<${name}> errored: ${err.message}`);
      } else {
        debug(`<${name}> completed`);
      }

      return callback.apply(executeOnBehalfOf, [err, output]);
    }

    executeArgs.push(serviceCallback);

    debug(`<${name}> execute with`, executeArgs);

    const serviceFn = parentContext.getServiceByName(name);
    return serviceFn.apply(executeOnBehalfOf, executeArgs);
  }

  function getInputArguments(variables) {
    if (inputParameters) {
      return inputParameters.map((parm) => parm.getInputValue(variables));
    }
    return [variables];
  }

  function getOutput(result, variablesAndServices) {
    if (!outputParameters) return result;

    return outputParameters.reduce((output, parm, idx) => {
      if (parm.valueType === 'expression') {
        output[parm.name] = parm.getOutputValue(result, variablesAndServices);
      } else {
        output[parm.name] = result[idx];
      }

      return output;
    }, {});
  }
};

function formatParameter(parm) {
  return Parameter(Object.assign({ positional: true}, parm));
}
