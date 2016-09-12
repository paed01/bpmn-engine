'use strict';

const debug = require('debug')('bpmn-engine:task:scriptTask');
const Activity = require('../activities/Activity');
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
  this.script = new vm.Script(this.activity.script, {
    filename: `${this.id}.script`,
    displayErrors: true
  });
};

util.inherits(internals.Task, Activity);

internals.Task.prototype.run = function(variables) {
  Activity.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this.taken = true;
  this.emit('start', this);

  this.executeScript(variables, (err) => {
    if (err) return this.emit('error', err);

    setImmediate(this.emit.bind(this, 'end', this));

    this.takeAllOutbound(variables);
  });
};

internals.Task.prototype.executeScript = function(variables, callback) {
  const context = new vm.createContext({
    context: variables,
    next: function(err) {
      if (err) return callback(new Error(err.message));
      callback();
    }
  });

  this.script.runInContext(context);
};

internals.Task.prototype.cancel = function() {
  debug(`<${this.id}>`, 'cancel');
  Activity.prototype.cancel.apply(this, arguments);
};
