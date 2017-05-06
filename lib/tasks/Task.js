'use strict';

const BaseTask = require('../activities/BaseTask');

function Task() {
  BaseTask.apply(this, arguments);
}

Task.prototype = Object.create(BaseTask.prototype);

Task.prototype.execute = function(input, callback) {
  this.emit('start', this);
  callback();
};

module.exports = Task;
