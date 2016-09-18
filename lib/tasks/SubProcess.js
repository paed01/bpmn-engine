'use strict';

const Process = require('../activities/BaseProcess');
const util = require('util');

const internals = {};

module.exports = internals.SubProcess = function() {
  Process.apply(this, arguments);
  this.isSubProcess = true;
};

util.inherits(internals.SubProcess, Process);
