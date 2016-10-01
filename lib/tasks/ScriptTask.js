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

internals.Task.prototype.execute = function(message, callback) {
  this._debug(`<${this.id}>`, 'execute', message);
  this.taken = true;
  this.emit('start', this);

  this.executeScript(this.parentContext.variables, message, (err, output) => {
    if (err) this.emit('error', err, this);
    else this.complete(output);
    if (callback) callback(err, output);
  });
};

internals.Task.prototype.executeScript = function(variables, messageOrCallback, callback) {
  script.execute(this.script, variables, messageOrCallback, callback);
};
