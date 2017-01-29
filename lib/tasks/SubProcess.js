'use strict';

const BaseProcess = require('../activities/BaseProcess');
const util = require('util');

const internals = {};

module.exports = internals.SubProcess = function() {
  BaseProcess.apply(this, arguments);
  this.isSubProcess = true;
};

util.inherits(internals.SubProcess, BaseProcess);

internals.SubProcess.prototype.run = function(message) {
  const input = this.getInput(message);
  return BaseProcess.prototype.run.call(this, input);
};
