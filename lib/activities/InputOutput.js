'use strict';

const debug = require('debug');
const scriptHelper = require('../script-helper');

const internals = {};

module.exports = internals.IO = function(activity, parentContext) {
  this.type = activity.$type;
  this.parentContext = parentContext;
  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);
  initParameters.call(this, activity.$children);
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
  this.input.forEach((parm) => {
    result[parm.name] = getValue.call(this, parm, message);
  });
  return result;
};

function initParameters(children) {
  this.input = children.filter((c) => c.$type === 'camunda:inputParameter').map(formatParameter);
  this.output = children.filter((c) => c.$type === 'camunda:outputParameter').map(formatParameter);
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

function getValue(parm, message) {
  if (parm.value) return parm.value;

  if (parm.script) {
    const executionContext = this.parentContext && this.parentContext.getFrozenVariablesAndServices();
    return scriptHelper.execute(parm.script, executionContext, message);
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
