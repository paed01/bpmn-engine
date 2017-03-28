'use strict';

const Context = require('../Context');
const BaseTask = require('./BaseTask');

function BaseProcess(activity, moddleOrParentContext, options) {
  this.isMainProcess = !isSubProcess(moddleOrParentContext);
  this.context = new Context(activity.id, (this.isMainProcess ? moddleOrParentContext : moddleOrParentContext.moddleContext), options);
  this.listener = options.listener;
  this.pendingActivities = [];

  BaseTask.call(this, activity, (this.isMainProcess ? this.context : moddleOrParentContext), options);

  this._debug(`<${activity.id}>`, 'init', !this.isMainProcess ? 'sub process' : 'main process');
}

BaseProcess.prototype = Object.create(BaseTask.prototype);

BaseProcess.prototype.execute = function(message) {
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
  if (this.isMainProcess) {
    emitListenerEvent.call(this, 'start', this);
  }

  if (this.context.childCount === 0) {
    return this.completeProcess(this.context.variables);
  }

  this.context.startActivities.forEach((activity) => activity.run());
};

BaseProcess.prototype.completeProcess = function() {
  this._debug(`<${this.id}>`, 'complete');
  deactivateAllChildren.call(this);

  this.variables = this.context.variables;
  this.isEnded = true;

  this.complete.call(this, this.variables);
};

BaseProcess.prototype.cancel = function() {
  deactivateAllChildren.call(this);
  BaseTask.prototype.cancel.apply(this, arguments);
};

BaseProcess.prototype.signal = function(childId, input) {
  this._debug(`<${this.id}>`, `signal <${childId}>`);
  const child = this.getChildActivityById(childId);
  if (child.isStartEvent) {
    this.context.applyMessage(input);
    return this.run();
  }

  if (child.isStart && !this.entered) {
    this.run();
  }

  child.signal(input);
};

BaseProcess.prototype.getChildActivityById = function(childId) {
  return this.context.getChildActivityById(childId);
};

BaseProcess.prototype.onChildEnter = function(activity) {
  this._debug(`<${this.id}>`, `enter <${activity.id}> (${activity.type})`);

  this.pendingActivities.push({
    id: activity.id
  });

  emitListenerEvent.call(this, 'enter', activity);
};

BaseProcess.prototype.onChildStart = function(activity) {
  emitListenerEvent.call(this, 'start', activity);
};

BaseProcess.prototype.onChildCancel = function(activity) {
  emitListenerEvent.call(this, 'cancel', activity);
};

BaseProcess.prototype.onChildWait = function(activity) {
  this._debug(`<${this.id}>`, `wait for <${activity.id}> (${activity.type})`);
  emitListenerEvent.call(this, 'wait', activity);
};

BaseProcess.prototype.onChildEnd = function(activity, output) {
  if (output) {
    if ((activity.io && activity.io.hasOutput) || activity.isStartEvent) {
      this._debug(`<${this.id}>`, `saving data from <${activity.id}> to variables`);
      this.context.applyMessage(output);
    } else {
      this.context.saveChildOutput(activity.id, output);
    }
  }

  emitListenerEvent.call(this, 'end', activity, output);

  if (activity.terminate) {
    this.completeProcess();
  }
};

BaseProcess.prototype.onChildLeave = function(activity) {
  this.pendingActivities = this.pendingActivities.filter((c) => c.id !== activity.id);

  this._debug(`<${this.id}>`, `left <${activity.id}> (${activity.type}), pending activities ${this.pendingActivities.length}`);
  emitListenerEvent.call(this, 'leave', activity);

  if (this.pendingActivities.length === 0) {
    this.completeProcess();
  }
};

BaseProcess.prototype.onChildError = function(err, child) {
  deactivateAllChildren.call(this);
  this.emit('error', err, child, this);
};

BaseProcess.prototype.onMessage = function(message, via) {
  this._debug(`<${this.id}>`, `message sent via <${via.id}> (${via.type})`);
  this.emit('message', this, message, via);
};

BaseProcess.prototype.onFlowDiscarded = function(flow) {
  emitListenerEvent.call(this, 'discared', flow);
};

BaseProcess.prototype.onFlowTaken = function(flow) {
  emitListenerEvent.call(this, 'taken', flow);
};

BaseProcess.prototype.getState = function() {
  const state = BaseTask.prototype.getState.call(this);
  Object.assign(state, this.context.getState());
  return state;
};

BaseProcess.prototype.getPendingActivities = function() {
  return this.context.getPendingActivities();
};

BaseProcess.prototype.resume = function(state) {
  this._debug(`<${this.id}>`, 'resume', state.entered ? 'execution' : 'state');
  this.context.resume(state);
  this.entered = state.entered;

  if (this.entered) {
    activateAllChildren.call(this);
    this.emit('enter', this);
  }

  const resumeStates = state.children.reduce((result, childState) => {
    if (childState.entered && childState.pendingJoin) {
      // Pending joins
      result.pre.push(childState);
    } else if (childState.attachedToId) {
      // Boundary events
      result.pre.push(childState);
    } else {
      result.post.push(childState);
    }

    return result;
  }, {
    pre: [],
    post: []
  });

  resumeStates.pre.forEach((childState) => {
    this.getChildActivityById(childState.id).resume(childState);
  });
  resumeStates.post.forEach((childState) => {
    this.getChildActivityById(childState.id).resume(childState);
  });
};

BaseProcess.prototype.deactivate = function() {
  deactivateAllChildren.call(this);
  BaseTask.prototype.deactivate.apply(this, arguments);
};

function isSubProcess(context) {
  return context instanceof Context;
}

function activateAllChildren() {
  const scope = this;

  scope._onChildEnter = scope.onChildEnter.bind(scope);
  scope._onChildStart = scope.onChildStart.bind(scope);
  scope._onChildWait = scope.onChildWait.bind(scope);
  scope._onChildEnd = scope.onChildEnd.bind(scope);
  scope._onChildCancel = scope.onChildCancel.bind(scope);
  scope._onChildLeave = scope.onChildLeave.bind(scope);
  scope._onChildError = scope.onChildError.bind(scope);
  scope._onMessage = scope.onMessage.bind(scope);
  scope._onFlowDiscarded = scope.onFlowDiscarded.bind(scope);
  scope._onFlowTaken = scope.onFlowTaken.bind(scope);

  Object.keys(scope.context.children).forEach((id) => {
    const activity = scope.context.children[id];
    setupChildActivity.call(scope, activity);
    activity.activate();
  });

  scope.context.messageFlows.forEach((flow) => {
    flow.on('message', this._onMessage);
  });

  scope.context.sequenceFlows.forEach((flow) => {
    setupFlowActivity.call(scope, flow);
  });
}

function deactivateAllChildren() {
  if (!this.entered) return;

  Object.keys(this.context.children).forEach((id) => {
    const child = this.context.children[id];
    teardownChildActivity.call(this, child);
    child.deactivate();
  });

  this.context.sequenceFlows.forEach((flow) => {
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
  flow.on('taken', this._onFlowTaken);
  flow.on('discarded', this._onFlowDiscarded);
}

function teardownFlowActivity(flow) {
  flow.removeListener('taken', this._onFlowTaken);
  flow.removeListener('discarded', this._onFlowDiscarded);
  flow.removeListener('message', this._onMessage);
}

function emitListenerEvent(eventName, activity, parent) {
  if (!this.listener) return;
  if (!parent) parent = this;
  this.listener.emit(`${eventName}-${activity.id}`, activity, parent);
  this.listener.emit(eventName, activity, parent);
}

module.exports = BaseProcess;
