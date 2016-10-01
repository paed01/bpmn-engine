'use strict';

const Activity = require('./Activity');
const async = require('async');
const util = require('util');

const internals = {};

module.exports = internals.BaseTask = function() {
  Activity.apply(this, arguments);
  this.loop = this.parentContext.getLoopCharacteristics(this.activity.loopCharacteristics);
};

util.inherits(internals.BaseTask, Activity);

internals.BaseTask.prototype.run = function(message) {
  Activity.prototype.run.apply(this, arguments);

  if (this.loop) {
    return this.runLoop(message, (err) => {
      this.loop.reset();
      if (err) return this.emit('error', err, this);
      this.complete();
    });
  }

  this._debug(`<${this.id}>`, 'run');
  this.execute(message);
};

internals.BaseTask.prototype.execute = function() {
};

internals.BaseTask.prototype.runLoop = function(message, callback) {
  if (this.loop.isSequential) {
    return sequentialLoop.call(this, message, callback);
  }
};

internals.BaseTask.prototype.complete = function(output) {
  this.emit('end', this, output);

  if (this.loop && !this.loop.completed) {
    return;
  }

  this.takeAllOutbound(this.getOutput(this.getInput(output)));
};

function sequentialLoop(message, callback) {
  const context = this;
  const loopDef = context.loop;
  this._debug(`<${this.id}>`, `iteration ${loopDef.iteration} in sequential loop`);

  const testFn = loopDef.run.bind(loopDef, context.parentContext.variables);
  function executeFn(next) {
    const messageContext = Object.assign({}, message);
    messageContext.loop = true;
    messageContext.index = loopDef.iteration;

    context.execute(messageContext, (err) => {
      if (err) return next(err);
      next();
    });
  }

  async.doUntil(executeFn, testFn, callback);
}
