'use strict';

const BaseTask = require('../activities/BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.Task = function() {
  BaseTask.apply(this, arguments);
  this._debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.execute = function(message, callback) {
  this._debug(`<${this.id}>`, 'execute');

  this.emit('start', this);

  // If callback is passed rebind signal function to pass callback
  if (callback) {
    this.signal = internals.Task.prototype.signal.bind(this, callback);
  } else {
    this.signal = internals.Task.prototype.signal.bind(this);
  }

  this.emit('wait', this);
};

internals.Task.prototype.signal = function(inputOrExecutionCallback, input) {
  if (typeof inputOrExecutionCallback !== 'function') {
    input = inputOrExecutionCallback;
    inputOrExecutionCallback = null;
  }

  this.dataOutput = input;
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled');
  this.complete(input);
  if (inputOrExecutionCallback) inputOrExecutionCallback();
};

internals.Task.prototype.cancel = function() {
  this._debug(`<${this.id}>`, 'cancel');
  BaseTask.prototype.cancel.apply(this, arguments);
};
