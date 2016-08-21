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

module.exports = pub;
