'use strict';

const pub = {};

pub.getOutboundSequenceFlows = function(context, activityId) {
  return context.references.filter((r) => r.property === 'bpmn:sourceRef' && r.id === activityId);
};

pub.hasInboundSequenceFlows = function(context, activityId) {
  return context.references.some((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
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

pub.isTerminationElement = function(element) {
  if (!element) return false;
  if (!element.eventDefinitions) return false;
  return element.eventDefinitions.some((e) => e.$type === 'bpmn:TerminateEventDefinition');
};

pub.getActivities = function(context) {
  const elements = [];
  Object.keys(context.elementsById).map((key) => {
    const element = context.elementsById[key];
    if (element.$type !== 'bpmn:SequenceFlow') {
      elements.push(element);
    }
  });
  return elements;
};

pub.getTasksWithoutInbound = function(context, myId) {
  const elements = [];
  pub.getActivities(context).forEach((element) => {
    if (element.id !== myId && !pub.hasInboundSequenceFlows(context, element.id)) {
      elements.push(element);
    }
  });
  return elements;
};

pub.getParallelGatewaysInPath = function(context, sequenceFlowId, touchedFlows) {
  const target = pub.getSequenceFlowTarget(context, sequenceFlowId);
  if (!touchedFlows) touchedFlows = {};

  if (context.elementsById[target.id].$type === 'bpmn:ParallelGateway') return [context.elementsById[target.id]];

  const outbound = pub.getOutboundSequenceFlows(context, target.id);
  let parallelGateways = [];
  outbound.forEach((flow) => {
    if (touchedFlows[flow.element.id]) return;

    touchedFlows[flow.element.id] = true;
    parallelGateways = parallelGateways.concat(pub.getParallelGatewaysInPath(context, flow.element.id, touchedFlows));
  });

  return parallelGateways;
};

module.exports = pub;
