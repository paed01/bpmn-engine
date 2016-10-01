'use strict';

const BaseTask = require('../activities/BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.Task = function() {
  BaseTask.apply(this, arguments);
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.execute = function(message, callback) {
  this.emit('start', this);
  this.complete();
  if (callback) callback();
};
