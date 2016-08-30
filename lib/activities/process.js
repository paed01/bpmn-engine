'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:activity:process');
const EventEmitter = require('events').EventEmitter;
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, context, listener) {
  this.activity = activity;
  this.context = context;
  this.children = {};
  this.paths = {};
  this.sequenceFlows = [];
  this.activeArtifacts = 0;
  this.stopInitialized = false;
  this.listener = listener;

  debug('init', this.activity.id);
  init.call(this, activity);
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  this.emit('start', this.activity);
  this.variables = Object.assign({}, variables);

  if (!this.startActivities.length) {
    return this.emit('end', this);
  }

  this.startActivities.forEach((activity) => start.call(this, activity));
};

internals.Activity.prototype.execute = function(target) {
  debug('execute', target.activity.id);
  execute.call(this, target);
};

internals.Activity.prototype.terminate = function() {
  this.isEnded = true;

  debug('terminate', this.activity.id, `active artifacts: ${this.activeArtifacts}`);

  Object.keys(this.children).forEach((id) => {
    const child = this.children[id];
    if (child._endListener) {
      child.removeListener('end', child._endListener);
    }
    child.cancel();
  });
  this.sequenceFlows.forEach((flow) => {
    if (flow._parentTakenListener) {
      flow.removeListener('taken', flow._parentTakenListener);
    }
    if (flow._parentDiscardedListener) {
      flow.removeListener('discarded', flow._parentDiscardedListener);
    }
    flow.cancel();
  });

  this.emit('end', this);
};

internals.Activity.prototype.stop = function(terminate) {
  if (terminate) return this.terminate();
  if (this.stopInitialized) return;

  debug('stop', this.activity.id, `active artifacts: ${this.activeArtifacts}`);
  if (this.activeArtifacts > 0) return;

  this.stopInitialized = true;

  this.terminate();
};

internals.Activity.prototype.getChildActivityById = function(activityId) {
  if (this.children[activityId]) return this.children[activityId];

  const activityDefinition = this.context.elementsById[activityId];
  const child = new (mapper(activityDefinition))(activityDefinition, this);

  this.children[activityDefinition.id] = child;

  return child;
};

internals.Activity.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

internals.Activity.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.target.id === activityId);
};

internals.Activity.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return contextHelper.isDefaultSequenceFlow(this.context, sequenceFlowId);
};

internals.Activity.prototype.getSequenceFlowTarget = function(sequenceFlowId) {
  return contextHelper.getSequenceFlowTarget(this.context, sequenceFlowId);
};

internals.Activity.prototype.signal = function(activityId, input) {
  const childActivity = this.getChildActivityById(activityId);
  childActivity.signal(input);
};

function init(activity) {
  if (!activity.flowElements) {
    this.startActivities = [];
    return;
  }
  this.startActivities = activity.flowElements.filter((e) => e.$type === 'bpmn:StartEvent');

  if (!this.startActivities.length) {
    debug('uncontrolled flow');
    this.startActivities = contextHelper.getTasksWithoutInbound(this.context, this.activity.id);
  }

  initSequenceFlows.call(this);
}

function initSequenceFlows() {
  contextHelper.getAllOutboundSequenceFlows(this.context).forEach((sf) => {
    const sequenceFlow = new (mapper(sf.element))(sf, this);
    this.sequenceFlows.push(sequenceFlow);
  });
}

function start(startEvent) {
  const startActivity = this.getChildActivityById(startEvent.id);
  execute.call(this, startActivity);
}

function execute(childActivity) {
  const self = this;

  if (childActivity.outbound) {
    // Listen for outbound flows
    childActivity.outbound.forEach((sequenceFlow) => {
      sequenceFlow._parentTakenListener = function(flow) {
        self.activeArtifacts--;

        flow.removeListener('discarded', sequenceFlow._parentDiscardedListener);
        const child = self.getChildActivityById(flow.target.id);

        self.paths[flow.activity.element.id] = flow;

        self.execute(child);
      };
      sequenceFlow._parentDiscardedListener = function(flow) {
        self.activeArtifacts--;
        flow.removeListener('taken', sequenceFlow._parentTakenListener);
      };

      self.activeArtifacts++;
      sequenceFlow.once('taken', sequenceFlow._parentTakenListener);
      sequenceFlow.once('discarded', sequenceFlow._parentDiscardedListener);
    });
  }

  childActivity.once('start', (activity) => {
    emitActivityEvent.call(self, 'start', activity);
  });

  childActivity._endListener = (c, output) => {
    self.activeArtifacts--;
    debug('completed', childActivity.activity.id, 'activeArtifacts', self.activeArtifacts);

    if (output) {
      saveOutput.call(this, c, output);
    }

    // Remove listeners
    if (childActivity._waitListener) {
      childActivity.removeListener('wait', childActivity._waitListener);
    }

    if (childActivity.isEnd) {
      if (childActivity.terminate) return self.terminate();

      setImmediate(self.stop.bind(self, childActivity.terminate));
    }
  };
  childActivity.once('end', childActivity._endListener);

  childActivity._waitListener = function(activity) {
    emitProcessEvent.call(self, 'wait', activity);
    emitActivityEvent.call(self, 'wait', activity);
  };
  childActivity.on('wait', childActivity._waitListener);

  childActivity.once('error', (e) => {
    self.emit('error', e);
  });

  self.activeArtifacts++;

  childActivity.run(this.variables);
}

function emitActivityEvent(eventName, activity) {
  if (!this.listener) return;
  this.listener.emit(`${eventName}-${activity.activity.id}`, activity, this);
}

function emitProcessEvent(eventName, activity) {
  if (!this.listener) return;
  this.listener.emit(eventName, this, activity);
}

function saveOutput(child, output) {
  const dataObjects = contextHelper.getChildOutputNames(this.context, child.activity.id);
  if (dataObjects.length) {
    dataObjects.forEach((dataObject) => {
      debug(`setting data from <${child.activity.id}> to variables["${dataObject.id}"]`);
      this.variables[dataObject.id] = output;
    });
  } else {
    debug(`setting data from <${child.activity.id}> to variables.taskInput["${child.activity.id}"]`);
    if (!this.variables.taskInput) this.variables.taskInput = {};
    this.variables.taskInput[child.activity.id] = output;
  }
}
