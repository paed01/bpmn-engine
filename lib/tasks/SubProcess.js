'use strict';

const Process = require('../activities/BaseProcess');
const util = require('util');

const internals = {};

module.exports = internals.SubProcess = function() {
  Process.apply(this, arguments);
};

util.inherits(internals.SubProcess, Process);
