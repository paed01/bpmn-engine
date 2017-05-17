'use strict';

const BaseProcess = require('../activities/BaseProcess');

function Process() {
  this.isMainProcess = true;
  BaseProcess.apply(this, arguments);
}

Process.prototype = Object.create(BaseProcess.prototype);

Process.prototype.completeProcess = function() {
  BaseProcess.prototype.completeProcess.call(this, () => {
    this.complete();
  });
};

module.exports = Process;
