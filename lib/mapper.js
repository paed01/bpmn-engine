'use strict';

const activityTypes = {};

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
activityTypes['bpmn:ScriptTask'] = require('./activities/scriptTask');
