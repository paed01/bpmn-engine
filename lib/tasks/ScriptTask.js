'use strict';

const BaseTask = require('../activities/BaseTask');
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Task = function() {
  BaseTask.apply(this, arguments);

  this.script = new vm.Script(this.activity.script, {
    filename: `${this.id}.script`,
    displayErrors: true
  });
};

util.inherits(internals.Task, BaseTask);

internals.Task.prototype.run = function() {
  BaseTask.prototype.run.call(this);

  this._debug(`<${this.id}>`, 'run');
  this.taken = true;
  this.emit('start', this);

  this.executeScript(this.parentContext.variables, (err) => {
    if (err) return this.emit('error', err);
    this.complete();
  });
};

internals.Task.prototype.executeScript = function(variables, callback) {
  const self = this;
  const context = new vm.createContext({
    context: variables,
    next: function(err) {
      self._debug(`<${self.id}>`, 'executed');
      if (err) return callback(new Error(err.message));
      callback();
    }
  });

  this.script.runInContext(context);
};
