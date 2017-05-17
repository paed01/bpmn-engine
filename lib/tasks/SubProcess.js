'use strict';

const BaseProcess = require('../activities/BaseProcess');

function SubProcess() {
  this.isSubProcess = true;
  BaseProcess.apply(this, arguments);
}

SubProcess.prototype = Object.create(BaseProcess.prototype);

module.exports = SubProcess;
