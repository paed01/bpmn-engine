'use strict';

const Activity = require('./activities/Activity');
const ContextHelper = require('./context-helper');
const DataObjects = require('./io/DataObjects');
const debug = require('debug')('bpmn-engine:context');
const Environment = require('./Environment');
const ExtensionsMapper = require('./extensions-mapper');
const mapper = require('./mapper');
const Service = require('./activities/Service');

module.exports = Context;

Context.setState = function(state, moddleContext, environment) {
  debug(`<${state.id}> set state`);
  return ContextInstance(state.id, moddleContext, environment.resume(state.environment));
};

function Context(processId, moddleContext, environment) {
  environment = environment ? environment.clone() : Environment();
  return ContextInstance(processId, moddleContext, environment);
}

function ContextInstance(processId, moddleContext, environment) {
  const id = processId;
  const type = 'context';
  const {elementsById} = moddleContext;
  const activity = elementsById[id];

  const contextHelper = ContextHelper(moddleContext);
  const activities = contextHelper.getActivities(id);
  const children = {}, outOfScopeActivities = {}, messageFlows = [], sequenceFlows = [];
  let childCount, dataObjects;

  const contextApi = {
    id,
    name: activity.name,
    type,
    activity,
    childCount,
    children,
    contextHelper,
    environment,
    messageFlows,
    moddleContext,
    sequenceFlows,
    clone,
    getActivityById,
    getActivityExtensions,
    getActivityIOReferences,
    getAttachedToActivity,
    getChildActivityById,
    getDataObjects,
    getInboundSequenceFlows,
    getOutboundSequenceFlows,
    getSequenceFlowTargetId,
    getService,
    getSubContext,
    isDefaultSequenceFlow,
  };

  const extensionsMapper = ExtensionsMapper(contextApi);

  initSequenceFlows();
  initChildren();

  return contextApi;

  function initSequenceFlows() {
    return contextHelper.getAllOutboundSequenceFlows(id).map((sf) => {
      const Flow = mapper(sf.element.$type);
      const flow = new Flow(sf, contextApi);

      sequenceFlows.push(flow);
      if (flow.outboundMessage) {
        messageFlows.push(flow);
      }
    });
  }

  function initChildren() {
    debug(`<${id}> init children`);

    activities.forEach((childActivity) => {
      const child = createChildById(childActivity.id, contextApi);
      if (child.placeholder) return;
      children[child.id] = child;
      ++childCount;
    });
  }

  function createChildById(childId, context, options) {
    const activityDefinition = elementsById[childId];

    const childArg = Activity(activityDefinition, contextApi);

    const ChildActivity = mapper(childArg.type);
    return new ChildActivity(childArg, context, options);
  }

  function getSubContext(childId, subEnvironment) {
    return ContextInstance(childId, moddleContext, subEnvironment || environment);
  }

  function clone(environmentOverride) {
    return Context(id, moddleContext, environmentOverride || environment);
  }

  function getOutboundSequenceFlows(activityId) {
    return sequenceFlows.filter(({sourceId}) => sourceId === activityId);
  }

  function getInboundSequenceFlows(activityId) {
    return sequenceFlows.filter(({outboundMessage, targetId}) => !outboundMessage && targetId === activityId);
  }

  function isDefaultSequenceFlow(sequenceFlowId) {
    return contextHelper.isDefaultSequenceFlow(sequenceFlowId);
  }

  function getSequenceFlowTargetId(sequenceFlowId) {
    return contextHelper.getSequenceFlowTargetId(sequenceFlowId);
  }

  function getAttachedToActivity(eventId) {
    const attachedTo = contextHelper.getAttachedToActivity(eventId);
    if (!attachedTo) return;

    return getChildActivityById(attachedTo.id);
  }

  function getChildActivityById(activityId) {
    return children[activityId];
  }

  function getActivityById(activityId) {
    const child = children[activityId];
    if (child) return child;

    let childActivity = outOfScopeActivities[activityId];
    if (childActivity) return childActivity;

    const activityDefinition = elementsById[activityId];
    const activityArg = Activity(activityDefinition, contextApi);

    const ActivityType = mapper(activityArg.type);
    childActivity = new ActivityType(activityArg, contextApi);

    outOfScopeActivities[activityId] = childActivity;

    return childActivity;
  }

  function getActivityExtensions(activityElement) {
    return extensionsMapper.get(activityElement);
  }

  function getDataObjects() {
    if (dataObjects) return dataObjects;
    dataObjects = DataObjects(contextHelper.getDataObjectReferences(), environment);
    return dataObjects;
  }

  function getActivityIOReferences(ioSpecification) {
    return contextHelper.getActivityIOReferences(ioSpecification);
  }

  function getService(activityElement) {
    return Service(activityElement, contextApi);
  }
}
