'use strict';

const activityTypes = {};

// activityTypes['bpmn:StartEvent'] = startEvent;
// activityTypes['bpmn:IntermediateThrowEvent'] = intermediateThrowEvent;
// activityTypes['bpmn:EndEvent'] = endEvent;
// activityTypes['bpmn:ExclusiveGateway'] = exclusiveGateway;
// activityTypes['bpmn:Task'] = task;
// activityTypes['bpmn:UserTask'] = userTask;
// activityTypes['bpmn:ServiceTask'] = serviceTask;
// activityTypes['bpmn:ParallelGateway'] = parallelGateway;

module.exports = function(activity) {
  const activityType = activityTypes[activity.$type];

  if (!activityType) {
    throw new Error(`Unknown activity type ${activity.$type}`);
  }

  return activityType;
};

activityTypes['bpmn:Process'] = require('./activities/process');
activityTypes['bpmn:StartEvent'] = require('./activities/startEvent');
activityTypes['bpmn:SequenceFlow'] = require('./activities/sequenceFlow');
activityTypes['bpmn:EndEvent'] = require('./activities/endEvent');
activityTypes['bpmn:ExclusiveGateway'] = require('./activities/exclusiveGateway');
activityTypes['bpmn:ParallelGateway'] = require('./activities/parallelGateway');
activityTypes['bpmn:InclusiveGateway'] = require('./activities/inclusiveGateway');
activityTypes['bpmn:UserTask'] = require('./activities/userTask');
