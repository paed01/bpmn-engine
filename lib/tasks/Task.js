'use strict';

const BaseTask = require('../activities/BaseTask');
const debug = require('debug')('bpmn-engine:task:task');
const util = require('util');

const internals = {};

module.exports = internals.Task = function() {
  BaseTask.apply(this, arguments);
  debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.run = function() {
  BaseTask.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');

  this.emit('start', this);

  this.complete();
};
