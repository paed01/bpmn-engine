'use strict';

const debug = require('debug')('bpmn-engine:task:scriptTask');
const Task = require('./Task');
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  Task.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
  this.script = new vm.Script(this.activity.script, {
    filename: `${this.id}.script`,
    displayErrors: true
  });
};

util.inherits(internals.Task, Task);

internals.Task.prototype.run = function(variables) {
  Task.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this.taken = true;
  this.emit('start', this);

  this.executeScript(variables, (err) => {
    if (err) return this.emit('error', err);
    this.emit('end', this);
    this.takeAllOutbound(variables);
  });
};

internals.Task.prototype.executeScript = function(variables, callback) {
  const self = this;
  const context = new vm.createContext({
    context: variables,
    next: function(err) {
      debug(`<${self.id}>`, 'executed');
      if (err) return callback(new Error(err.message));
      callback();
    }
  });

  this.script.runInContext(context);
};

internals.Task.prototype.cancel = function() {
  debug(`<${this.id}>`, 'cancel');
  Task.prototype.cancel.apply(this, arguments);
};
