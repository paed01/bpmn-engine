'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:context');
const mapper = require('./mapper');

const internals = {};

module.exports = internals.Context = function(processId, moddleContext, listener, variables) {
  this.id = processId;

  this.listener = listener;
  this.moddleContext = moddleContext;
  this.variables = Object.assign({}, variables);
  this.sequenceFlows = loadSequenceFlows.call(this, this.id);
  loadChildren.call(this, this.id);
};

internals.Context.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

internals.Context.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.targetId === activityId);
};

internals.Context.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return contextHelper.isDefaultSequenceFlow(this.moddleContext, sequenceFlowId);
};

internals.Context.prototype.getSequenceFlowTargetId = function(sequenceFlowId) {
  return contextHelper.getSequenceFlowTargetId(this.moddleContext, sequenceFlowId);
};

internals.Context.prototype.getBoundaryEvents = function(activityId) {
  const boundaryEvents = contextHelper.getBoundaryEvents(this.moddleContext, activityId);
  return boundaryEvents.map((e) => this.getChildActivityById(e.element.id));
};

internals.Context.prototype.getChildActivityById = function(activityId) {
  let child = this.children[activityId];
  if (!child) {
    child = createChildById.call(this, activityId, this, this.listener);
    this.children[activityId] = child;
  }
  return child;
};

internals.Context.prototype.saveChildOutput = function(childId, output) {
  debug(`<${this.id}>`, `save <${childId}> output`, output);

  const dataObjects = contextHelper.getChildOutputNames(this.moddleContext, childId);
  if (dataObjects.length) {
    dataObjects.forEach((dataObject) => {
      debug(`<${this.id}>`, `setting data from <${childId}> to variables["${dataObject.id}"]`);
      this.variables[dataObject.id] = output;
    });
  } else {
    debug(`<${this.id}>`, `setting data from <${childId}> to variables.taskInput["${childId}"]`);
    if (!this.variables.taskInput) this.variables.taskInput = {};
    this.variables.taskInput[childId] = output;
  }
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
  this.childCount = 0;

  contextHelper.getActivities(this.moddleContext, scopeId).forEach((activity) => {
    if (!mapper.isSupportedType(activity.$type)) return;
    if (this.children[activity.id]) return;

    const child = createChildById.call(this, activity.id, this, this.listener);

    this.children[child.id] = child;

    this.childCount++;

    if (child.isStart) this.startActivities.push(child);
    if (child.isEnd) this.endActivities.push(child);
  });
}

function createChildById(id, context, listener) {
  const activityDefinition = this.moddleContext.elementsById[id];
  const ChildActivity = mapper(activityDefinition);
  return new ChildActivity(activityDefinition, context, listener);
}
