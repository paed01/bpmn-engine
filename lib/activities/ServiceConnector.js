'use strict';

const debug = require('debug')('bpmn-engine:service');
const Parameter = require('../parameter');

function ServiceConnector(connector, parentContext) {
  this.type = connector.$type || 'string';
  this.name = connector.connectorId || connector.name;
  debug(`<${this.name}>`, 'type', this.type);
  this.connector = connector;
  this.parentContext = parentContext;

  if (this.connector.inputOutput) {
    initParameters.call(this, connector);
  }
}

ServiceConnector.prototype.execute = function(executeOnBehalfOf, message, callback) {
  const scope = this;
  const executeArgs = this.getInputArguments(message);

  function serviceCallback() {
    const resultArgs = Array.prototype.slice.call(arguments, 0);
    const err = resultArgs[0];

    const output = scope.getOutput(resultArgs.slice(1));

    debug(`<${scope.name}>`, 'completed');

    return callback.apply(null, [err, output]);
  }

  executeArgs.push(serviceCallback);

  debug(`<${this.name}>`, 'execute with', executeArgs);

  const serviceFn = scope.parentContext.getServiceByName(this.name);

  return serviceFn.apply(null, executeArgs);
};

ServiceConnector.prototype.getInputArguments = function(variables) {
  if (this.input) {
    return this.input.map((parm) => parm.getInputValue(variables));
  }
  return [variables];
};

ServiceConnector.prototype.getOutput = function(result) {
  if (!this.output) return result;

  return this.output.reduce((output, parm, idx) => {
    output[parm.name] = result[idx];
    return output;
  }, {});
};

function initParameters(connector) {
  this.input = connector.inputOutput.inputParameters.map(formatParameter);
  this.output = connector.inputOutput.outputParameters.map(formatParameter);
}

function formatParameter(parm) {
  return Parameter(Object.assign({ positional: true}, parm));
}

module.exports = ServiceConnector;
