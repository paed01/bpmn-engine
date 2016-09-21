'use strict';

const pub = {};

pub.getProcesses = function(context) {
  return context.rootHandler.element.rootElements.filter((e) => e.$type === 'bpmn:Process');
};

pub.getOutboundSequenceFlows = function(context, activityId) {
  return context.references.filter((r) => r.property === 'bpmn:sourceRef' && r.id === activityId);
};

pub.hasInboundSequenceFlows = function(context, activityId) {
  return context.references.some((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
};

pub.getInboundSequenceFlows = function(context, activityId) {
  return context.references.filter((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
};

pub.getSequenceFlowTargetId = function(context, sequenceFlowId) {
  const target = context.references.find((r) => r.property === 'bpmn:targetRef' && r.element.id === sequenceFlowId);
  return target && target.id;
};

pub.isDefaultSequenceFlow = function(context, sequenceFlowId) {
  return context.references.some((r) => r.property === 'bpmn:default' && r.id === sequenceFlowId);
};

pub.getTargetProcess = function(context, targetId) {
  const elements = context.rootHandler.element.rootElements;
  return elements.find((e) => e.$type === 'bpmn:Process' && e.flowElements.some((f) => f.id === targetId));
};

pub.getActivityIO = function(context, activityId) {
  const activity = context.elementsById[activityId];
  if (!activity.extensionElements) return;

  return activity.extensionElements.values.find((v) => v.$type === 'camunda:inputOutput');
};

pub.getAllOutboundSequenceFlows = function(context, scopeActivityId) {
  const scope = context.elementsById[scopeActivityId];
  const outbound = context.references.filter((r) => {
    if (r.property !== 'bpmn:sourceRef') return false;
    switch (r.element.$type) {
      case 'bpmn:MessageFlow':
      case 'bpmn:SequenceFlow':
        break;
      default:
        return false;
    }

    const sourceId = r.id;
    return scope.flowElements.some((e) => e.id === sourceId);
  });

  return outbound;
};

pub.getChildOutputNames = function(context, taskId) {
  const contextElement = context.elementsById[taskId];
  if (!contextElement.dataOutputAssociations) return [];

  return contextElement.dataOutputAssociations.map((association) => {
    return pub.getDataObjectFromAssociation(context, association.id);
  });
};

pub.getDataObjectFromAssociation = function(context, associationId) {
  const association = context.references.find((r) => r.element.$type === 'bpmn:DataOutputAssociation' && r.element.id === associationId && r.property === 'bpmn:targetRef');
  if (!association) return null;

  const potentialRef = context.elementsById[association.id];
  if (potentialRef.$type === 'bpmn:DataObject') return potentialRef;

  return pub.getDataObjectFromRef(context, potentialRef.id);
};

pub.getDataObjectFromRef = function(context, refId) {
  const ref = context.references.find((r) => r.element.$type === 'bpmn:DataObjectReference' && r.element.id === refId && r.property === 'bpmn:dataObjectRef');
  if (!ref) return null;

  return context.elementsById[ref.id];
};

pub.isTerminationElement = function(element) {
  if (!element) return false;
  if (!element.eventDefinitions) return false;
  return element.eventDefinitions.some((e) => e.$type === 'bpmn:TerminateEventDefinition');
};

pub.getActivities = function(context, scopeActivityId) {
  const elements = [];
  const scope = context.elementsById[scopeActivityId];

  if (!scope.flowElements) return elements;

  Object.keys(context.elementsById).forEach((key) => {
    if (!scope.flowElements.some((e) => e.id === key)) return;

    const element = context.elementsById[key];
    switch (element.$type) {
      case 'bpmn:SequenceFlow':
      case 'bpmn:Definitions':
        break;
      default:
        elements.push(element);
    }
  });

  return elements;
};

pub.getBoundaryEvents = function(context, scopeId) {
  return context.references.filter((r) => r.property === 'bpmn:attachedToRef' && r.id === scopeId);
};

module.exports = pub;
