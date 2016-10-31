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

  this.inboundMessage = message;

  if (this.loop) {
    return this.runLoop(message, (err, output) => { // eslint-disable-line handle-callback-err
      this.complete = internals.BaseTask.prototype.complete.bind(this);
      this.loop.reset();
      this.complete(output);
    });
  }

  this._debug(`<${this.id}>`, 'run');
  this.execute(message);
};

internals.BaseTask.prototype.execute = function() {
};

internals.BaseTask.prototype.runLoop = function(message, callback) {
  return sequentialLoop.call(this, message, callback);
};

internals.BaseTask.prototype.complete = function(loopCallbackOrOutput, output) {
  if (typeof loopCallbackOrOutput !== 'function') {
    output = loopCallbackOrOutput;
    loopCallbackOrOutput = null;
  }
  this.emit('end', this, output);

  if (this.loop && !this.loop.completed) {
    return loopCallbackOrOutput(null, output);
  }

  this.takeAllOutbound(this.getOutput(this.getInput(output)));
};

function sequentialLoop(message, callback) {
  const scope = this;
  const loopDef = scope.loop;

  const testFn = loopDef.run.bind(loopDef, this.parentContext.getVariablesAndServices(), scope.inboundMessage);
  function executeFn(next) {
    scope._debug(`<${scope.id}>`, `iteration ${loopDef.iteration} in sequential loop`);

    const messageScope = Object.assign({}, message);
    messageScope.loop = true;
    messageScope.index = loopDef.iteration;

    scope.complete = internals.BaseTask.prototype.complete.bind(scope, next);

    scope.execute(messageScope);
  }

  async.doUntil(executeFn, testFn, callback);
}
