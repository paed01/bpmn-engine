'use strict';

const BaseProcess = require('../activities/BaseProcess');

function SubProcess() {
  BaseProcess.apply(this, arguments);
  this.isSubProcess = true;
}

SubProcess.prototype = Object.create(BaseProcess.prototype);

SubProcess.prototype.run = function(message) {
  const input = this.getInput(message);
  return BaseProcess.prototype.run.call(this, input);
};

module.exports = SubProcess;
