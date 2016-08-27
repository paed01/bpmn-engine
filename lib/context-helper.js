'use strict';

const pub = {};

pub.getOutboundSequenceFlows = function(context, activityId) {
  return context.references.filter((r) => r.property === 'bpmn:sourceRef' && r.id === activityId);
};

pub.getInboundSequenceFlows = function(context, activityId) {
  return context.references.filter((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
};

pub.getSequenceFlowTarget = function(context, sequenceFlowId) {
  return context.references.find((r) => r.property === 'bpmn:targetRef' && r.element.id === sequenceFlowId);
};

pub.isDefaultSequenceFlow = function(context, sequenceFlowId) {
  return context.references.some((r) => r.property === 'bpmn:default' && r.id === sequenceFlowId);
};

pub.getAllOutboundSequenceFlows = function(context) {
  return context.references.filter((r) => r.element.$type === 'bpmn:SequenceFlow' && r.property === 'bpmn:sourceRef');
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

module.exports = pub;
