'use strict';

const debug = require('debug');
const scriptHelper = require('../script-helper');

const internals = {};

module.exports = internals.IO = function(activity) {
  this.type = activity.$type;
  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);
  initParameters.call(this, activity.$children);
};

internals.IO.prototype.getOutput = function(variables) {
  const result = {};
  this.output.forEach((parm) => {
    result[parm.name] = getValue.call(this, parm, variables);
  });
  return result;
};

internals.IO.prototype.getInput = function(variables) {
  const result = {};
  this.input.forEach((parm) => {
    result[parm.name] = getValue.call(this, parm, variables);
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

function getValue(parm, variables) {
  if (parm.value) return parm.value;

  if (parm.script) {
    return scriptHelper.execute(parm.script, variables);
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
