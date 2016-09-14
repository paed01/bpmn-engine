'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:context');
const mapper = require('./mapper');

const internals = {};

module.exports = internals.Context = function(processId, moddleContext) {
  this.id = processId;
  this.moddleContext = moddleContext;
  this.sequenceFlows = loadSequenceFlows.call(this, this.id);
  loadChildren.call(this, this.id);
};

internals.Context.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

internals.Context.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.target.id === activityId);
};

internals.Context.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return contextHelper.isDefaultSequenceFlow(this.moddleContext, sequenceFlowId);
};

internals.Context.prototype.getSequenceFlowTarget = function(sequenceFlowId) {
  return contextHelper.getSequenceFlowTarget(this.moddleContext, sequenceFlowId);
};

internals.Context.prototype.getBoundaryEvents = function(activityId) {
  const boundaryEvents = contextHelper.getBoundaryEvents(this.moddleContext, activityId);
  return boundaryEvents.map((e) => this.getChildActivityById(e.element.id));
};

internals.Context.prototype.getChildActivityById = function(activityId) {
  return this.children[activityId];
};

function loadSequenceFlows(scopeId) {
  return contextHelper.getAllOutboundSequenceFlows(this.moddleContext, scopeId).map((sf) => {
    return new mapper.SequenceFlow(sf, this);
  });
}

function loadChildren(scopeId) {
  debug(`<${this.id}>`, 'load children');
  this.children = {};
  this.startActivities = [];
  this.endActivities = [];

  contextHelper.getActivities(this.moddleContext, scopeId).forEach((activity) => {
    if (!mapper.isSupportedType(activity.$type)) return;

    const activityDefinition = this.moddleContext.elementsById[activity.id];
    const ChildActivity = mapper(activityDefinition);
    const child = new ChildActivity(activityDefinition, this);

    this.children[activityDefinition.id] = child;
    if (child.isStart) this.startActivities.push(child);
    if (child.isEnd) this.endActivities.push(child);
  });
}

