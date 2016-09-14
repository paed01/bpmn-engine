'use strict';

const activityTypes = {};

module.exports = function(activity) {
  const activityType = activityTypes[activity.$type];

  if (!activityType) {
    throw new Error(`Unknown activity type ${activity.$type}`);
  }

  return activityType;
};

module.exports.isTask = function(type) {
  if (!type) return false;
  return /task$/i.test(type);
};

module.exports.isSupportedType = function(type) {
  return !!activityTypes[type];
};

module.exports.SequenceFlow = activityTypes['bpmn:SequenceFlow'] = require('./activities/SequenceFlow');

activityTypes['bpmn:Process'] = require('./activities/Process');

activityTypes['bpmn:StartEvent'] = require('./events/StartEvent');
activityTypes['bpmn:EndEvent'] = require('./events/EndEvent');

activityTypes['bpmn:ExclusiveGateway'] = require('./gateways/ExclusiveGateway');
activityTypes['bpmn:ParallelGateway'] = require('./gateways/ParallelGateway');
activityTypes['bpmn:InclusiveGateway'] = require('./gateways/InclusiveGateway');

activityTypes['bpmn:Task'] = require('./tasks/Task');
activityTypes['bpmn:UserTask'] = require('./tasks/UserTask');
activityTypes['bpmn:SubProcess'] = require('./tasks/SubProcess');
activityTypes['bpmn:ScriptTask'] = require('./tasks/ScriptTask');

activityTypes['bpmn:BoundaryEvent'] = require('./events/BoundaryEvent');
activityTypes['bpmn:TimerEventDefinition'] = require('./events/TimerEventDefinition');
