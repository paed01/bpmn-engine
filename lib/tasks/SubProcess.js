'use strict';

const BaseProcess = require('../activities/BaseProcess');
const util = require('util');

const internals = {};

module.exports = internals.SubProcess = function() {
  BaseProcess.apply(this, arguments);
  this.isSubProcess = true;
};

util.inherits(internals.SubProcess, BaseProcess);

internals.SubProcess.prototype.getInput = function(message) {
  if (!this.io) return this.io.getInput(message);
};
