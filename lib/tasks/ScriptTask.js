'use strict';

const BaseTask = require('../activities/BaseTask');
const script = require('../script');
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity) {
  if (!script.isJavascript(activity.scriptFormat)) throw new Error(`Script format ${activity.scriptFormat} is unsupported (<${activity.id}>)`);

  BaseTask.apply(this, arguments);
  this.script = script.parse(`${this.id}.script`, this.activity.script);
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.run = function() {
  BaseTask.prototype.run.call(this);

  this._debug(`<${this.id}>`, 'run');
  this.taken = true;
  this.emit('start', this);

  this.executeScript(this.parentContext.variables, (err) => {
    if (err) return this.emit('error', err, this);
    this.complete();
  });
};

internals.Task.prototype.executeScript = function(variables, callback) {
  script.execute(this.script, variables, callback);
};
