'use strict';

const BaseTask = require('../activities/BaseTask');

function SendTask() {
  BaseTask.apply(this, arguments);
}

SendTask.prototype = Object.create(BaseTask.prototype);

SendTask.prototype.execute = function(message) {
  this.emit('start', this);
  this.complete(message);
};

module.exports = SendTask;
