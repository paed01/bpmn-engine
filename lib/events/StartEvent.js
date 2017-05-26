'use strict';

const Activity = require('../activities/Activity');

function StartEvent(activity, parent) {
  Activity.call(this, activity, parent);
  this.isStart = true;
  this.isStartEvent = true;
  this.form = this.parentContext.getActivityForm(activity);
  this.saveToVariables = !!this.form || this.hasInboundMessage;
}

module.exports = StartEvent;

StartEvent.prototype = Object.create(Activity.prototype);

StartEvent.prototype.run = function(message) {
  Activity.prototype.run.apply(this, arguments);

  this._debug(`<${this.id}> run`);
  const executionContext = this.getExecutionContext(message, this.getVariablesAndServices());
  this.getInput = executionContext.getInput;

  this.execute(executionContext, (err, result) => {
    if (err) return this.emit('error', err, this);

    executionContext.setResult(result);

    this.getOutput = executionContext.getOutput;

    this.complete(this.getOutput());
  });
};

StartEvent.prototype.complete = function(output) {
  this.taken = true;
  this.emit('end', this, output);
  this.takeAllOutbound(output);
};

StartEvent.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}>`, 'execute');

  if (this.form || this.hasInboundMessage) {
    this.emit('start', executionContext.getActivityApi({
      waiting: true
    }));
    this.waiting = true;

    return this.emit('wait', executionContext.postpone(callback));
  }

  return callback(null, executionContext.getOutput());
};

StartEvent.prototype.signal = function() {
};

StartEvent.prototype.complete = function(output) {
  const ioOutput = this.getOutput(output);
  this.emit('end', this, ioOutput);
  this.takeAllOutbound(ioOutput);
};

StartEvent.prototype.getState = function() {
  const state = Activity.prototype.getState.call(this);
  if (this.waiting) state.waiting = this.waiting;
  if (this.form) {
    state.form = this.form.getState();
  }
  return state;
};
