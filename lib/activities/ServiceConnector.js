'use strict';

const internals = {};
const scriptHelper = require('../script-helper');

module.exports = internals.Connector = function(connector, parentContext) {
  this.type = connector.$type || 'string';
  this.name = connector.connectorId || connector.name;
  this.connector = connector;

  initParameters.call(this, connector);
};

internals.Connector.prototype.getInputArguments = function(variables) {
  if (this.input) {
    return this.input.map(getParmValue.bind(null, variables));
  }
  return variables;
};

function initParameters(connector) {
  this.input = connector.inputOutput.inputParameters.map(formatParameter);
  this.output = connector.inputOutput.outputParameters.map(formatParameter);
}

function formatParameter(rawParm) {
  const parm = {
    name: rawParm.name
  };
  if (rawParm.$body) {
    parm.value = rawParm.$body;
  } else {
    parm.script = getParmScript(rawParm);
  }

  return parm;
}

function getParmScript(rawParm) {
  if (!rawParm.$children) return;

  const firstVal = rawParm.$children[0];
  if (!firstVal) return;

  if (firstVal.$type === 'camunda:script') {
    if (!scriptHelper.isJavascript(firstVal.scriptFormat)) throw new Error(`Script format ${firstVal.scriptFormat} is unsupported (${rawParm.name})`);
    return scriptHelper.parse(`${rawParm.name}.io`, firstVal.$body);
  }
}

function getParmValue(variables, parm) {
  if (parm.value) return parm.value;

  if (parm.script) {
    return scriptHelper.execute(parm.script, variables);
  }
}

