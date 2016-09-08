'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:activity:process');
const EventEmitter = require('events').EventEmitter;
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent, listener) {
  this.id = activity.id;
  this.activity = activity;

  if (parent.context) {
    debug(`<${this.id}> is a sub process`);
    this.context = parent.context;
    this.listener = parent.listener;
    this.inbound = parent.getInboundSequenceFlows(this.id);
    this.outbound = parent.getOutboundSequenceFlows(this.id);
    this.isEnd = this.outbound.length === 0;
  } else {
    this.context = parent;
    this.listener = listener;
  }

  this.children = {};
  this.paths = {};
  this.sequenceFlows = [];
  this.activeArtifacts = 0;
  this.stopInitialized = false;

  init.call(this, activity);
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  this.emit('start', this.activity);
  this.variables = Object.assign({}, variables);

  if (!this.startActivities.length) {
    return this.terminate();
  }

  this.startActivities.forEach((activity) => start.call(this, activity));
};

internals.Activity.prototype.execute = function(target, takenFlow) {
  debug(`<${this.id}>`, `execute <${target.id}>`);
  execute.call(this, target, takenFlow);
};

internals.Activity.prototype.cancel = function() {
  this.terminate();
};

internals.Activity.prototype.terminate = function() {
  if (this.isEnded) return;

  this.isEnded = true;

  debug(`terminate <${this.id}>`, `active artifacts: ${this.activeArtifacts}`);

  Object.keys(this.children).forEach((id) => {
    const child = this.children[id];
    if (child._parentStartListener) {
      child.removeListener('start', child._parentStartListener);
      delete child._parentStartListener;
    }
    if (child._parentEndListener) {
      child.removeListener('end', child._parentEndListener);
      delete child._parentEndListener;
    }
    child.cancel();
  });
  this.sequenceFlows.forEach((flow) => {
    if (flow._parentTakenListener) {
      flow.removeListener('taken', flow._parentTakenListener);
      delete flow._parentTakenListener;
    }
    if (flow._parentDiscardedListener) {
      flow.removeListener('discarded', flow._parentDiscardedListener);
      delete flow._parentDiscardedListener;
    }
    flow.cancel();
  });

  this.emit('end', this);

  if (this.outbound) {
    takeAll.call(this, this.outbound, this.variables);
  }
};

internals.Activity.prototype.stop = function(terminate) {
  if (terminate) return this.terminate();
  if (this.stopInitialized) return;

  debug(`stop <${this.id}>`, `active artifacts: ${this.activeArtifacts}`);

  if (this.activeArtifacts > 0) return;
  this.stopInitialized = true;

  this.terminate();
};

internals.Activity.prototype.getChildActivityById = function(activityId) {
  if (this.children[activityId]) return this.children[activityId];

  const activityDefinition = this.context.elementsById[activityId];
  const Activity = mapper(activityDefinition);
  const child = new Activity(activityDefinition, this);

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
  debug(`init <${this.id}>`);

  if (!activity.flowElements) {
    this.startActivities = [];
    return;
  }
  this.startActivities = activity.flowElements.filter((e) => e.$type === 'bpmn:StartEvent');

  if (!this.startActivities.length) {
    debug(`<${this.id}> uncontrolled flow`);
    this.startActivities = contextHelper.getTasksWithoutInbound(this.context, this.id);
  }

  initSequenceFlows.call(this);
}

function initSequenceFlows() {
  contextHelper.getAllOutboundSequenceFlows(this.context, this.id).forEach((sf) => {
    const SequenceFlow = mapper(sf.element);
    const sequenceFlow = new SequenceFlow(sf, this);
    this.sequenceFlows.push(sequenceFlow);
  });
}

function start(startEvent) {
  const startActivity = this.getChildActivityById(startEvent.id);
  execute.call(this, startActivity);
}

function execute(childActivity, takenFlow) {
  const self = this;

  if (childActivity.entered) {
    debug(`<${this.id}>`, `entering <${childActivity.id}> again`);
    return childActivity.run(this.variables, takenFlow);
  }

  if (childActivity.outbound) {
    // Listen for outbound flows
    childActivity.outbound.forEach((sequenceFlow) => {
      sequenceFlow._parentTakenListener = function(flow) {
        self.activeArtifacts--;

        flow.removeListener('taken', sequenceFlow._parentTakenListener);
        flow.removeListener('discarded', sequenceFlow._parentDiscardedListener);
        const child = self.getChildActivityById(flow.target.id);

        self.paths[flow.activity.element.id] = flow;

        self.execute(child, flow);
      };
      sequenceFlow._parentDiscardedListener = function(flow) {
        self.activeArtifacts--;

        flow.removeListener('taken', sequenceFlow._parentTakenListener);
        flow.removeListener('discarded', sequenceFlow._parentDiscardedListener);

        followDiscardedSequenceFlow.call(self, flow);
      };

      self.activeArtifacts++;
      sequenceFlow.once('taken', sequenceFlow._parentTakenListener);
      sequenceFlow.once('discarded', sequenceFlow._parentDiscardedListener);
    });
  }

  childActivity._parentStartListener = (c) => {
    emitActivityEvent.call(self, 'start', c);
  };

  childActivity.once('start', childActivity._parentStartListener);

  childActivity._parentEndListener = (c, output) => {
    self.activeArtifacts--;
    debug(`<${this.id}>`, `completed <${childActivity.id}>`, 'activeArtifacts', self.activeArtifacts);

    if (output) {
      saveOutput.call(this, c, output);
    }

    emitActivityEvent.call(self, 'end', c);

    // Remove listeners
    if (childActivity._waitListener) {
      childActivity.removeListener('wait', childActivity._waitListener);
    }

    if (childActivity.isEnd) {
      if (childActivity.terminate) return self.terminate();

      setImmediate(self.stop.bind(self, childActivity.terminate));
    }
  };
  childActivity.once('end', childActivity._parentEndListener);

  childActivity._waitListener = function(activity) {
    emitProcessEvent.call(self, 'wait', activity);
    emitActivityEvent.call(self, 'wait', activity);
  };
  childActivity.on('wait', childActivity._waitListener);

  childActivity.once('error', (e) => {
    self.emit('error', e);
  });

  self.activeArtifacts++;

  childActivity.run(this.variables, takenFlow);
}

function emitActivityEvent(eventName, activity) {
  if (!this.listener) return;
  this.listener.emit(`${eventName}-${activity.id}`, activity, this);
}

function emitProcessEvent(eventName, activity) {
  if (!this.listener) return;
  this.listener.emit(eventName, this, activity);
}

function saveOutput(child, output) {
  const dataObjects = contextHelper.getChildOutputNames(this.context, child.activity.id);
  if (dataObjects.length) {
    dataObjects.forEach((dataObject) => {
      debug(`<${this.id}>`, `setting data from <${child.id}> to variables["${dataObject.id}"]`);
      this.variables[dataObject.id] = output;
    });
  } else {
    debug(`<${this.id}>`, `setting data from <${child.id}> to variables.taskInput["${child.id}"]`);
    if (!this.variables.taskInput) this.variables.taskInput = {};
    this.variables.taskInput[child.activity.id] = output;
  }
}

function followDiscardedSequenceFlow(discardedFlow) {
  const gateways = contextHelper.getParallelGatewaysInPath(this.context, discardedFlow.id);
  gateways.forEach((gatewayElement) => {
    const gateway = this.getChildActivityById(gatewayElement.id);

    debug(`<${this.id}>`, `followed discarded <${discardedFlow.id}> to <${gateway.id}>`);

    this.execute(gateway, discardedFlow);
  });
}

function takeAll(outbound, variables) {
  if (this.isEnd) return;

  debug(`take all <${this.id}> ${outbound.length} sequence flows`);
  outbound.forEach(take.bind(this, variables));
}

function take(variables, outboundSequenceFlow) {
  outboundSequenceFlow.take(variables);
}
