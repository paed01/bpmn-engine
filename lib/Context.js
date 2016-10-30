'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:context');
const mapper = require('./mapper');

const internals = {};

module.exports = internals.Context = function(processId, moddleContext, options) {
  this.id = processId;

  this.listener = options.listener;
  this.moddleContext = moddleContext;
  this.variables = Object.assign({}, options.variables);
  this.services = Object.assign({}, options.services);
  loadSequenceFlows.call(this, this.id);
  loadChildren.call(this, this.id);
};

internals.Context.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

internals.Context.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => !sf.outboundMessage && sf.targetId === activityId);
};

internals.Context.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return contextHelper.isDefaultSequenceFlow(this.moddleContext, sequenceFlowId);
};

internals.Context.prototype.getSequenceFlowTargetId = function(sequenceFlowId) {
  return contextHelper.getSequenceFlowTargetId(this.moddleContext, sequenceFlowId);
};

internals.Context.prototype.hasAttachedErrorEvent = function(activityId) {
  return contextHelper.hasAttachedErrorEvent(this.moddleContext, activityId);
};

internals.Context.prototype.getAttachedToActivity = function(eventId) {
  const attachedTo = contextHelper.getAttachedToActivity(this.moddleContext, eventId);
  if (!attachedTo) return;

  return this.getChildActivityById(attachedTo.id);
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

internals.Context.prototype.getActivityIO = function(activityId) {
  const io = contextHelper.getActivityIO(this.moddleContext, activityId);
  if (!io) return;
  return new mapper.ActivityIO(io);
};

internals.Context.prototype.applyMessage = function(message) {
  Object.assign(this.variables, message);
};

internals.Context.prototype.getLoopCharacteristics = function(loopCharacteristics) {
  if (!loopCharacteristics) return;
  return new (mapper(loopCharacteristics.$type))(loopCharacteristics);
};

internals.Context.prototype.getState = function() {
  return {
    variables: JSON.parse(JSON.stringify(this.variables)),
    services: JSON.parse(JSON.stringify(this.services))
  };
};

function loadSequenceFlows(scopeId) {
  this.sequenceFlows = [];
  this.messageFlows = [];
  return contextHelper.getAllOutboundSequenceFlows(this.moddleContext, scopeId).map((sf) => {
    const Flow = mapper(sf.element.$type);
    const flow = new Flow(sf, this);

    this.sequenceFlows.push(flow);
    if (flow.outboundMessage) {
      this.messageFlows.push(flow);
    }
  });
}

function loadChildren(scopeId) {
  debug(`<${this.id}>`, 'load children');
  this.children = {};
  this.startActivities = [];
  this.endActivities = [];
  this.childCount = 0;

  contextHelper.getActivities(this.moddleContext, scopeId).forEach((activity) => {
    let child = this.children[activity.id];
    if (!child) {
      child = createChildById.call(this, activity.id, this, this.listener);
      if (child.placeholder) return;
      this.children[child.id] = child;
      this.childCount++;
    }
    if (child.isStart) this.startActivities.push(child);
    if (child.isEnd) this.endActivities.push(child);
  });
}

function createChildById(id, context, listener) {
  const activityDefinition = this.moddleContext.elementsById[id];
  if (!activityDefinition) throw new Error(`Child by id <${id}> was not found`);
  const ChildActivity = mapper(activityDefinition.$type);
  return new ChildActivity(activityDefinition, context, listener);
}
