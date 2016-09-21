'use strict';

const debug = require('debug');
const vm = require('vm');

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

internals.IO.prototype.executeScript = function(name, variables, body) {
  this._debug(name, 'execute', variables);
  const script = new vm.Script(body, {
    filename: name,
    displayErrors: true
  });
  const context = new vm.createContext({
    context: variables
  });
  const result = script.runInContext(context);
  this._debug(name, `condition result evaluated to ${result}`, variables);
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
    parm.scriptBody = getParmScript(rawParm);
  }

  return parm;
}

function getValue(parm, variables) {
  if (parm.value) return parm.value;

  if (parm.scriptBody) {
    return this.executeScript(`${parm.name}.io`, variables, parm.scriptBody);
  }
}

function getParmScript(parm) {
  if (!parm.$children) return;

  const firstVal = parm.$children[0];
  if (!firstVal) return;


  if (firstVal.$type === 'camunda:script' && /^javascript$/i.test(firstVal.scriptFormat)) {
    return firstVal.$body;
  }
}
