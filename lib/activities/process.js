'use strict';

const contextHelper = require('../context-helper');
const debug = require('debug')('bpmn-engine:activity:process');
const EventEmitter = require('events').EventEmitter;
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, context) {
  this.activity = activity;
  this.context = context;
  this.children = {};
  this.paths = {};
  this.sequenceFlows = [];
  this.activeArtifacts = 0;
  this.stopInitialized = false;

  debug('init', this.activity.id);
  init.call(this, activity);
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.run = function(variables) {
  this.emit('start', this.activity);
  if (!this.startEvents.length) {
    return this.emit('end', this);
  }
  this.variables = Object.assign({}, variables);

  start.call(this, this.startEvents[0]);
};

internals.Activity.prototype.take = function(target) {
  this.execute(target);
};

internals.Activity.prototype.execute = function(target) {
  debug('execute', target.activity.id);
  execute.call(this, target);
};

internals.Activity.prototype.stop = function() {
  if (this.stopInitialized) return;

  debug('stop', this.activity.id, `active artifacts: ${this.activeArtifacts}`);
  if (this.activeArtifacts !== 0) return;

  this.stopInitialized = true;

  Object.keys(this.children).forEach((id) => {
    const child = this.children[id];
    if (child.endListener) {
      child.removeListener('end', child.endListener);
    }
  });
  this.isEnded = true;
  this.emit('end', this);
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

function init(activity) {
  this.startEvents = activity.flowElements.filter((e) => e.$type === 'bpmn:StartEvent');
  initSequenceFlows.call(this);
}

function initSequenceFlows() {
  this.context.references.filter((r) => r.property === 'bpmn:sourceRef').forEach((sf) => {
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

  childActivity.once('end', () => {
    self.activeArtifacts--;
    debug('completed', childActivity.activity.id, 'activeArtifacts', self.activeArtifacts);

    if (childActivity.isEndEvent) {
      setImmediate(self.stop.bind(self));
    }
  });

  self.activeArtifacts++;
  childActivity.run(this.variables);
}
