'use strict';

const debug = require('debug');
const scriptHelper = require('../script-helper');

const internals = {};

module.exports = internals.IO = function(activity, parentContext) {
  this.type = activity.$type;
  this.parentContext = parentContext;
  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);
  this.activity = activity;
  initParameters.call(this);
};

internals.IO.prototype.getOutput = function(output) {
  const result = {};
  this._debug('get output');
  this.output.forEach((parm) => {
    result[parm.name] = getValue.call(this, parm, output);
  });
  return result;
};

internals.IO.prototype.getInput = function(message) {
  const result = {};
  this._debug('get input', message);

  const variablesAndServices = this.parentContext && this.parentContext.getFrozenVariablesAndServices();

  this.input.forEach((parm) => {
    result[parm.name] = getValue.call(this, parm, message, variablesAndServices);
  });
  return result;
};

internals.IO.prototype.getInputArguments = function(message) {
  const result = [];
  this._debug('get input arguments', message);

  const variablesAndServices = this.parentContext && this.parentContext.getFrozenVariablesAndServices();

  this.input.forEach((parm) => {
    result.push(getValue.call(this, parm, message, variablesAndServices));
  });
  return result;
};

function initParameters() {
  if (this.type === 'camunda:InputOutput') {
    this.input = this.activity.inputParameters.map(formatParameter);
    this.output = this.activity.outputParameters.map(formatParameter);
  } else {
    const collection = this.activity.$children;
    this.input = collection.filter((c) => c.$type === 'camunda:inputParameter').map(formatParameter);
    this.output = collection.filter((c) => c.$type === 'camunda:outputParameter').map(formatParameter);
  }
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

function getValue(parm, message, variablesAndServices) {
  if (parm.value) return parm.value;
  if (parm.script) {
    return scriptHelper.execute(parm.script, variablesAndServices, message);
  }
  if (message && message[parm.name]) {
    return message[parm.name];
  }
  if (variablesAndServices) {
    return variablesAndServices.variables[parm.name];
  }
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
