'use strict';

const Context = require('../Context');
const debug = require('debug')('bpmn-engine:process');
const BaseTask = require('./BaseTask');
const util = require('util');

const internals = {};

module.exports = internals.Process = function(activity, moddleOrParentContext, options) {
  this.context = getContext(activity, moddleOrParentContext, options);
  this.listener = options && options.listener;
  this.pendingActivities = [];

  debug(`<${activity.id}>`, 'init', this.listener ? 'with listener' : 'without listener');

  BaseTask.call(this, activity, (isSubprocess(moddleOrParentContext) ? moddleOrParentContext : this.context), options);
};

util.inherits(internals.Process, BaseTask);

function isSubprocess(context) {
  return context instanceof Context;
}

function getContext(activity, moddleOrParentContext, options) {
  if (isSubprocess(moddleOrParentContext)) {
    debug(`<${activity.id}>`, 'is most likelly a subProcess');
    return new Context(activity.id, moddleOrParentContext.moddleContext, options);
  }

  debug(`<${activity.id}>`, 'is most likelly a main process');
  return new Context(activity.id, moddleOrParentContext, options);
}

internals.Process.prototype.execute = function(message) {
  this._debug(`<${this.id}>`, 'execute');
  this.isEnded = false;

  this.context.applyMessage(message);

  activateAllChildren.call(this);

  this.pendingActivities = this.context.startActivities.map(c => {
    return {
      type: c.type,
      id: c.id
    };
  });

  this.emit('start', this);

  if (this.context.childCount === 0) {
    return this.completeProcess(this.context.variables);
  }

  this.context.startActivities.forEach((activity) => activity.run());
};

internals.Process.prototype.completeProcess = function() {
  this._debug(`<${this.id}>`, 'complete');
  deactivateAllChildren.call(this);

  this.variables = this.context.variables;
  this.isEnded = true;

  this.complete.call(this, this.variables);
};

internals.Process.prototype.cancel = function() {
  deactivateAllChildren.call(this);
  BaseTask.prototype.cancel.apply(this, arguments);
};

internals.Process.prototype.signal = function(childId, input) {
  this._debug(`<${this.id}>`, `signal <${childId}>`);
  const child = this.getChildActivityById(childId);
  if (child.isStartEvent) {
    this.context.applyMessage(input);
    return this.run();
  }

  child.signal(input);
};

internals.Process.prototype.getChildActivityById = function(childId) {
  return this.context.getChildActivityById(childId);
};

internals.Process.prototype.onChildEnter = function(activity, fromFlow) {
  this._debug(`<${this.id}>`, `enter <${activity.id}> (${activity.type})`);

  // Look ahead and push to pending activities
  if (activity.outbound.length > 0) {

    if (!fromFlow || !fromFlow.discarded) {
      activity.outbound.forEach((flow) => {
        if (flow.outboundMessage) return;
        this.pendingActivities.push({
          id: flow.targetId
        });
      });
    }
  }

  emitListenerEvent.call(this, 'enter', activity);
};

internals.Process.prototype.onChildStart = function(activity) {
  emitListenerEvent.call(this, 'start', activity);
};

internals.Process.prototype.onChildCancel = function(activity) {
  emitListenerEvent.call(this, 'cancel', activity);
};

internals.Process.prototype.onChildWait = function(activity) {
  this._debug(`<${this.id}>`, `wait for <${activity.id}> (${activity.type})`);
  emitListenerEvent.call(this, 'wait', activity);
};

internals.Process.prototype.onChildEnd = function(activity, output) {
  if (output) {
    this.context.saveChildOutput(activity.id, output);
  }

  emitListenerEvent.call(this, 'end', activity, output);

  if (activity.terminate) {
    this.completeProcess();
  }
};

internals.Process.prototype.onChildLeave = function(activity) {
  this.pendingActivities = this.pendingActivities.filter((c) => c.id !== activity.id);
  this._debug(`<${this.id}>`, `left <${activity.id}> (${activity.type}), pending activities ${this.pendingActivities.length}`);
  emitListenerEvent.call(this, 'leave', activity);
};

internals.Process.prototype.onChildError = function(err) {
  this.emit('error', err);
};

internals.Process.prototype.onMessage = function(message, via) {
  this._debug(`<${this.id}>`, `message sent via <${via.id}> (${via.type})`);
  this.emit('message', this, message, via);
};

internals.Process.prototype.getState = function() {
  const state = BaseTask.prototype.getState.call(this);
  Object.assign(state, this.context.getState());
  return state;
};

internals.Process.prototype.resume = function(state) {
  this._debug(`<${this.id}>`, 'resume');
  this.context.resume(state);
  this.entered = true;
  activateAllChildren.call(this);
  this.emit('enter', this);

  state.children.reduce((result, currentChildState, idx, childStates) => {
    // Resume boundary events first
    if (!currentChildState.attachedToId) {
      childStates.filter(boundaryChild => boundaryChild.attachedToId === currentChildState.id).forEach((boundaryChild) => {
        const boundIndex = childStates.findIndex(c => c.id === boundaryChild.id);
        if (boundIndex > idx) {
          this.getChildActivityById(boundaryChild.id).resume(boundaryChild);
          childStates.splice(boundIndex, 1);
        }
      });
    }

    this.getChildActivityById(currentChildState.id).resume(currentChildState);
    return result;
  }, -Infinity);
};

internals.Process.prototype.getVariablesAndServices = function() {
  return this.context.getVariablesAndServices();
};

internals.Process.prototype.deactivate = function() {
  deactivateAllChildren.call(this);
  BaseTask.prototype.deactivate.apply(this, arguments);
};

function activateAllChildren() {
  const scope = this;

  scope._onChildEnter = scope.onChildEnter.bind(this);
  scope._onChildStart = scope.onChildStart.bind(this);
  scope._onChildWait = scope.onChildWait.bind(this);
  scope._onChildEnd = scope.onChildEnd.bind(this);
  scope._onChildCancel = scope.onChildCancel.bind(this);
  scope._onChildLeave = scope.onChildLeave.bind(this);
  scope._onChildError = scope.onChildError.bind(this);

  Object.keys(scope.context.children).forEach((id) => {
    const activity = scope.context.children[id];
    setupChildActivity.call(this, activity);
    activity.activate();
  });

  scope._onEndActivityLeave = function(activity) {
    if (scope.pendingActivities.filter(a => !a.canceled).length === 0) {
      scope._debug(`<${scope.id}>`, `reached end of process with <${activity.id}>`);
      scope._debug(`<${scope.id}>`, `No of active ${scope.pendingActivities.length}`);
      return scope.completeProcess();
    }
  };

  scope.context.endActivities.forEach((activity) => {
    activity.on('leave', scope._onEndActivityLeave);
  });

  scope.context.messageFlows.forEach((flow) => {
    setupFlowActivity.call(this, flow);
  });
}

function deactivateAllChildren() {
  Object.keys(this.context.children).forEach((id) => {
    const child = this.context.children[id];
    teardownChildActivity.call(this, child);
    child.deactivate();
  });

  this.context.messageFlows.forEach((flow) => {
    teardownChildActivity.call(this, flow);
  });

  this.context.endActivities.forEach((activity) => {
    activity.removeListener('leave', this._onEndActivityLeave);
  });

  this.context.messageFlows.forEach((flow) => {
    teardownFlowActivity.call(this, flow);
  });
}

function setupChildActivity(activity) {
  const self = this;
  this._debug(`<${self.id}>`, `setup <${activity.id}>`);

  activity.on('enter', this._onChildEnter);
  activity.on('start', this._onChildStart);
  activity.on('wait', this._onChildWait);
  activity.on('cancel', this._onChildCancel);
  activity.on('end', this._onChildEnd);
  activity.on('leave', this._onChildLeave);

  if (!this.context.hasAttachedErrorEvent(activity.id)) {
    activity.on('error', this._onChildError);
  }
}

function teardownChildActivity(activity) {
  this._debug(`<${this.id}>`, `tear down <${activity.id}>`);

  activity.removeListener('enter', this._onChildEnter);
  activity.removeListener('start', this._onChildStart);
  activity.removeListener('wait', this._onChildWait);
  activity.removeListener('cancel', this._onChildCancel);
  activity.removeListener('end', this._onChildEnd);
  activity.removeListener('leave', this._onChildLeave);
  activity.removeListener('error', this._onChildError);
}

function setupFlowActivity(flow) {
  this._onMessage = this.onMessage.bind(this);
  flow.on('message', this._onMessage);
}

function teardownFlowActivity(flow) {
  this._debug(`<${this.id}>`, `tear down flow <${flow.id}>`);
  flow.removeListener('message', this._onMessage);
}

function emitListenerEvent(eventName, activity, parent) {
  if (!this.listener) return;
  if (!parent) parent = this;
  this.listener.emit(`${eventName}-${activity.id}`, activity, parent);
  this.listener.emit(eventName, activity, parent);
}
