'use strict';

const debug = require('debug');
const Parameter = require('../parameter');

function InputOutput(activity, parentContext) {
  this.type = activity.$type;
  this.parentContext = parentContext;
  this._debug = debug(`bpmn-engine:io:${this.type.toLowerCase()}`);
  this.activity = activity;
  initParameters.call(this);
  this.hasOutput = this.output && this.output.length;
}

InputOutput.prototype.getInput = function(message, editableContextVariables) {
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

InputOutput.prototype.getOutput = function(output) {
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

function initParameters() {
  this.input = this.activity.inputParameters && this.activity.inputParameters.map(Parameter);
  this.output = this.activity.outputParameters && this.activity.outputParameters.map(Parameter);
}

module.exports = InputOutput;
