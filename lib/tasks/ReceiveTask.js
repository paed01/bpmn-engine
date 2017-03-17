'use strict';

const BaseTask = require('../activities/BaseTask');

function ReceiveTask() {
  BaseTask.apply(this, arguments);
}

ReceiveTask.prototype = Object.create(BaseTask.prototype);

ReceiveTask.prototype.execute = function() {
  this._debug(`<${this.id}>`, 'execute');
  this.emit('start', this);
  this.waiting = true;
  this.emit('wait', this);
};

ReceiveTask.prototype.signal = function(input) {
  if (!this.waiting) {
    return this.emit('error', new Error(`<${this.id}> is not waiting`), this);
  }

  this.waiting = false;
  this.dataOutput = input;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled', input);
  this.complete(input);
};

module.exports = ReceiveTask;
