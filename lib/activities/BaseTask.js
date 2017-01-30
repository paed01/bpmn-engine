'use strict';

const Activity = require('./Activity');
const async = require('async');
const PrematureStopError = require('../PrematureStopError');

const internals = {};

module.exports = internals.BaseTask = function() {
  Activity.apply(this, arguments);
  this.loop = this.parentContext.getLoopCharacteristics(this.activity.loopCharacteristics);
};

internals.BaseTask.prototype = Object.create(Activity.prototype);

internals.BaseTask.prototype.run = function(message) {
  Activity.prototype.run.apply(this, arguments);

  this.inboundMessage = message;

  if (this.loop) {
    return this.runLoop(message, (err, output) => { // eslint-disable-line handle-callback-err
      this.complete = internals.BaseTask.prototype.complete.bind(this);
      if (!(err instanceof PrematureStopError)) {
        this.loop.reset();
      } else {
        this._debug(`<${this.id}>`, 'prematurely stopped');
      }

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
  const ioOutput = this.getOutput(output);
  this.emit('end', this, ioOutput);

  if (this.loop && !this.loop.completed) {
    return loopCallbackOrOutput(null, ioOutput);
  }

  this.takeAllOutbound(ioOutput);
};

internals.BaseTask.prototype.deactivate = function() {
  Activity.prototype.deactivate.apply(this, arguments);
  if (this.loop) {
    this.loop.deactivate();
  }
};

internals.BaseTask.prototype.getState = function() {
  const state = Activity.prototype.getState.apply(this, arguments);
  if (this.loop) state.loop = this.loop.getState();
  return state;
};

internals.BaseTask.prototype.resume = function(state) {
  if (this.loop) {
    this.loop.resume(state.loop);
  }

  Activity.prototype.resume.apply(this, arguments);
};

function sequentialLoop() {
  if (this.loop.characteristics.type === 'collection') {
    sequentialCollectionLoop.apply(this, arguments);
  } else {
    sequentialConditionLoop.apply(this, arguments);
  }
}

function sequentialConditionLoop(message, callback) {
  const scope = this;
  const loopDef = scope.loop;

  const testFn = loopDef.run.bind(loopDef, scope.parentContext.getVariablesAndServices(), scope.inboundMessage);

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

function sequentialCollectionLoop(message, callback) {
  const scope = this;

  const loopDef = scope.loop;
  const collection = loopDef.getCollection();
  const executionContext = scope.parentContext.getVariablesAndServices();

  function executeFn(item, next) {
    scope._debug(`<${scope.id}>`, `iteration ${loopDef.iteration} in sequential collection loop`);

    const messageScope = Object.assign({}, message);
    messageScope.loop = true;
    messageScope.index = loopDef.iteration;
    messageScope.item = item;

    scope.complete = internals.BaseTask.prototype.complete.bind(scope, getLoopCallback(loopDef, executionContext, scope.inboundMessage, next));

    scope.execute(messageScope);
  }

  async.eachSeries(collection, executeFn, callback);
}

function getLoopCallback(loopDef, executionContext, inboundMessage, callback) {
  return (err, result) => {
    if (err) return callback(err, result);

    loopDef.run(executionContext, inboundMessage, result, (loopErr) => {
      callback(loopErr, result);
    });
  };
}

