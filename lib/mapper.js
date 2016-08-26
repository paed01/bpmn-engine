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
activityTypes['bpmn:SequenceFlow'] = require('./activities/sequenceFlow');

activityTypes['bpmn:StartEvent'] = require('./events/startEvent');
activityTypes['bpmn:EndEvent'] = require('./events/endEvent');

activityTypes['bpmn:ExclusiveGateway'] = require('./gateways/exclusiveGateway');
activityTypes['bpmn:ParallelGateway'] = require('./gateways/parallelGateway');
activityTypes['bpmn:InclusiveGateway'] = require('./gateways/inclusiveGateway');

activityTypes['bpmn:UserTask'] = require('./tasks/userTask');
activityTypes['bpmn:ScriptTask'] = require('./tasks/scriptTask');
