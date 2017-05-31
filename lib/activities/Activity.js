'use strict';

const activityExecution = require('./activity-execution');
const debug = require('debug');
const EventEmitter = require('events').EventEmitter;

function Activity(activity, parentContext) {
  this.parentContext = parentContext;
  this.activity = activity;

  this.id = activity.id;
  this.type = activity.type;
  this.name = activity.name;
  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);

  this.hasInboundMessage = activity.hasInboundMessage;

  this.inbound = activity.inbound;
  this.outbound = activity.outbound;

  this.io = activity.io;

  this.properties = activity.properties;

  this.multipleInbound = this.inbound.length > 1;
  this.isStart = this.inbound.length === 0;
  this.isEnd = this.outbound.length === 0;
  this.entered = false;

  this._debug(`<${this.id}>`, 'init');
}

Activity.prototype = Object.create(EventEmitter.prototype);

Activity.prototype.activate = function() {
  this.setupInboundListeners();
};

Activity.prototype.deactivate = function() {
  this.teardownInboundListeners();
};

Activity.prototype.run = function(message, inboundFlow, rootFlow) {
  this.canceled = false;
  this.taken = false;
  this.enter();

  const executionContext = activityExecution(this, message, this.parentContext.getVariablesAndServices(), inboundFlow, rootFlow);
  this.getInput = executionContext.getInput;

  this.execute(executionContext, (err, result, hasOutputParameters) => {
    if (err) return this.emit('error', err, this);

    if (result !== undefined) {
      executionContext.setResult(result);
    }

    this.getOutput = executionContext.getOutput;

    this.complete(getTaskOutput(this.id, hasOutputParameters || executionContext.hasOutputParameters, executionContext.getOutput()));
  });
};

Activity.prototype.complete = function(output) {
  this.taken = true;
  this.emit('end', this, output);
  this.takeAllOutbound(output);
};

Activity.prototype.getExecutionContext = function() {
  const args = Array.prototype.slice.call(arguments, 0);
  args.unshift(this);
  return activityExecution.apply(null, args);
};

Activity.prototype.resume = function(state) {
  if (state.taken !== undefined) {
    this.taken = state.taken;
  }
  if (state.canceled !== undefined) {
    this.canceled = state.canceled;
  }
  if (!state.entered) return;
  this._debug(`<${this.id}>`, 'resume');
  this.run();
};

Activity.prototype.enter = function(flow) {
  this._debug(`<${this.id}>`, 'enter');
  if (this.entered) {
    throw new Error(`Already entered <${this.id}>`);
  }

  this.entered = true;
  this.emit('enter', this, flow);
};

Activity.prototype.leave = function() {
  this._debug(`<${this.id}>`, 'leave');
  if (!this.entered) {
    throw new Error(`Already left <${this.id}>`);
  }
  this.pendingDiscard = false;
  this.entered = false;
  setImmediate(() => {
    this.emit('leave', this);
  });
};

Activity.prototype.cancel = function() {
  this.canceled = true;

  this._debug(`<${this.id}>`, 'cancel');
  this.emit('cancel', this);

  this.takeAllOutbound();
};

Activity.prototype.onInbound = function(flow) {
  if (flow.discarded) {
    return discardedInbound.apply(this, arguments);
  }
  const message = this.getInput();
  return this.run(message);
};

Activity.prototype.onLoopedInbound = function() {
  if (this.entered) this.leave();
};

Activity.prototype.discard = function(flow, rootFlow) {
  if (!this.entered) this.enter(flow);
  return this.discardAllOutbound(rootFlow);
};

function discardedInbound(flow, rootFlow) {
  if (!this.multipleInbound) {
    return this.discard(flow, rootFlow);
  }

  if (!this.pendingDiscard) {
    this._debug(`<${this.id}>`, `pending inbound from discarded <${flow.id}>`);
    this.pendingDiscard = true;

    // Remove one since one inbound flow must have been taken
    this.pendingLength = this.inbound.length - 1;

    // Emit leave because we are not waiting for discarded flow
    this.emit('leave', this);

    return;
  }


  this.pendingLength--;
  this._debug(`<${this.id}>`, `inbound from discarded <${flow.id}> - pending ${this.pendingLength}`);
  if (this.pendingLength === 0) {
    this.discard(flow, rootFlow);
  }
}

Activity.prototype.takeAllOutbound = function(message) {
  if (!this.isEnd) {
    this._debug(`<${this.id}>`, `take all outbound (${this.outbound.length})`);
    this.outbound.forEach((flow) => flow.take(message));
  }
  this.leave();
};

Activity.prototype.discardAllOutbound = function(rootFlow) {
  if (!this.isEnd) {
    this._debug(`<${this.id}>`, `discard all outbound (${this.outbound.length})`);
    this.outbound.forEach((flow) => {
      flow.discard(rootFlow);
    });
  }
  this.leave(rootFlow);
};

Activity.prototype.setupInboundListeners = function() {
  if (!this.inbound.length) return;
  if (this._onInbound) return;
  this._onInbound = this.onInbound.bind(this);
  this._onLoopedInbound = this.onLoopedInbound.bind(this);

  this.inbound.forEach((flow) => {
    flow.on('taken', this._onInbound);
    flow.on('discarded', this._onInbound);
    flow.on('looped', this._onLoopedInbound);
  });
};

Activity.prototype.teardownInboundListeners = function() {
  if (!this._onInbound) return;
  this.inbound.forEach((flow) => {
    flow.removeListener('taken', this._onInbound);
    flow.removeListener('discarded', this._onInbound);
    flow.removeListener('looped', this._onLoopedInbound);
  });

  delete this._onInbound;
};

Activity.prototype.getOutput = function() {
};

Activity.prototype.getInput = function(message) {
  // if (!this.io) return message;
  // return this.io.getInput(message);
};

Activity.prototype.getState = function() {
  const result = {
    id: this.id,
    type: this.type,
    entered: this.entered
  };

  if (this.taken !== undefined) {
    result.taken = this.taken;
  }
  if (this.canceled !== undefined) {
    result.canceled = this.canceled;
  }

  return result;
};

Activity.prototype.getVariablesAndServices = function() {
  return this.parentContext.getVariablesAndServices();
};

module.exports = Activity;

function getTaskOutput(id, hasDefinedOutput, output) {
  if (hasDefinedOutput) {
    return output;
  }
  const result = {
    taskInput: {}
  };
  result.taskInput[id] = output;
  return result;
}
