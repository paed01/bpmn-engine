'use strict';

const debug = require('debug');
const Parameter = require('../parameter');

const internals = {};

module.exports = internals.IO = function(activity, parentContext) {
  this.type = activity.$type;
  this.parentContext = parentContext;
  this._debug = debug(`bpmn-engine:io:${this.type.toLowerCase()}`);
  this.activity = activity;
  initParameters.call(this);
};

internals.IO.prototype.getInput = function(message, editableContextVariables) {
  const result = {};

  if (!this.input) {
    this._debug('no input parameters, return variables and services');
    return this.parentContext.getVariablesAndServices(message, !editableContextVariables);
  }

  this._debug('get input from', message || 'variables');

  const frozenVariablesAndServices = this.parentContext && this.parentContext.getFrozenVariablesAndServices();
  this.input.forEach((parm) => {
    result[parm.name] = parm.getInputValue(message, frozenVariablesAndServices);
  });
  return result;
};

internals.IO.prototype.getInputArguments = function(message) {
  const result = [];

  this._debug('get input arguments from', message || 'variables only');

  const variablesAndServices = this.parentContext && this.parentContext.getFrozenVariablesAndServices(message);
  if (!this.input) {
    return [variablesAndServices];
  }

  this.input.forEach((parm) => {
    result.push(parm.getInputValue(message, variablesAndServices));
  });

  this._debug('input arguments', result);

  return result;
};

internals.IO.prototype.getOutput = function(output) {
  const result = {};
  if (!this.output) {
    return output;
  }

  const frozenVariablesAndServices = this.parentContext && this.parentContext.getFrozenVariablesAndServices();

  this._debug('get output', output);
  this.output.forEach((parm) => {
    result[parm.name] = parm.getOutputValue(output, frozenVariablesAndServices);
  });

  return result;
};

internals.IO.prototype.getOutputFromArguments = function() {
  const result = {};
  this._debug('get output');
  const outputArguments = Array.prototype.slice.call(arguments, 0);
  this.output.forEach((parm, idx) => {
    result[parm.name] = outputArguments[idx];
  });
  return result;
};

function initParameters() {
  this.input = this.activity.inputParameters && this.activity.inputParameters.map(Parameter);
  this.output = this.activity.outputParameters && this.activity.outputParameters.map(Parameter);
}
