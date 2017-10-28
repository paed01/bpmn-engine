'use strict';

const Debug = require('debug');
const Parameter = require('./Parameter');
const getNormalizedResult = require('./getNormalizedResult');

module.exports = function Connector(connector, parentContext) {
  const type = connector.$type;
  const name = connector.connectorId;
  const {environment} = parentContext;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

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

  return {
    name,
    type,
    activate
  };

  function activate(parentApi, inputContext) {
    let iParms, oParms;
    const {id: activityId} = parentApi;
    const {isLoopContext, index} = inputContext;

    debug(`<${activityId}> service${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    return {
      name,
      type,
      execute
    };

    function execute(message, callback) {
      const executeArgs = getInputArguments(message);
      executeArgs.push(serviceCallback);

      debug(`<${name}> execute with`, executeArgs);

      const serviceFn = environment.getServiceByName(name);
      return serviceFn.apply(parentApi, executeArgs);

      function serviceCallback(err, ...args) {
        const output = getOutput(args);

        if (err) {
          debug(`<${name}> errored: ${err.message}`);
        } else {
          debug(`<${name}> completed`);
        }

        return callback(err, output);
      }
    }

    function getInputArguments() {
      if (inputParameters) {
        return getInputParameters().map((parm) => parm.get());
      }

      return [inputContext];
    }

    function getOutput(result) {
      if (!outputParameters) return result;

      const resolveResult = getNormalizedResult(result);

      return getOutputParameters().reduce((output, parm, idx) => {
        if (parm.valueType === 'expression') {
          output[parm.name] = parm.resolve(resolveResult);
        } else {
          output[parm.name] = result[idx];
        }
        return output;
      }, {});
    }

    function getInputParameters() {
      if (iParms) return iParms;
      if (!inputParameters) return [];
      iParms = inputParameters.map((parm) => parm.activate(inputContext));
      return iParms;
    }

    function getOutputParameters(reassign) {
      if (!outputParameters) return [];
      if (!reassign && oParms) return oParms;
      oParms = outputParameters.map((parm) => parm.activate(inputContext));
      return oParms;
    }
  }

  function formatParameter(parm) {
    return Parameter(Object.assign({ positional: true}, parm), environment);
  }
};
