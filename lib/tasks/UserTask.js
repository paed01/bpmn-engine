'use strict';

const debug = require('debug')('bpmn-engine:task:userTask');
const Task = require('./Task');
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  Task.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Task, Task);

internals.Task.prototype.run = function(variables) {
  Task.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this._variables = variables;

  this.emit('start', this);
  this.emit('wait', this);
};

internals.Task.prototype.signal = function(input) {
  this.dataOutput = input;
  this.taken = true;

  debug(`<${this.id}>`, 'signaled');
  this.emit('end', this, input);

  this.takeAllOutbound(this._variables);
};

internals.Task.prototype.cancel = function() {
  debug(`<${this.id}>`, 'cancel');
  Task.prototype.cancel.apply(this, arguments);
};
