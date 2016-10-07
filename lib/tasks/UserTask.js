'use strict';

const BaseTask = require('../activities/BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.Task = function() {
  BaseTask.apply(this, arguments);
  this._debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.execute = function() {
  this._debug(`<${this.id}>`, 'execute');
  this.emit('start', this);
  this.waiting = true;
  this.emit('wait', this);
};

internals.Task.prototype.signal = function(input) {
  if (!this.waiting) {
    throw new Error(`<${this.id}> is not waiting`);
  }

  this.waiting = false;

  this.dataOutput = input;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled', input);
  this.complete(input);
};

internals.Task.prototype.cancel = function() {
  this._debug(`<${this.id}>`, 'cancel');
  BaseTask.prototype.cancel.apply(this, arguments);
};
