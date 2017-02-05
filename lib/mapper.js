'use strict';

const activityTypes = {};

module.exports = function fromType(type) {
  const activityType = activityTypes[type];

  if (!activityType) {
    throw new Error(`Unknown activity type ${type}`);
  }

  return activityType;
};

module.exports.isTask = function(type) {
  if (!type) return false;
  return /task$/i.test(type);
};

module.exports.Definition = activityTypes['bpmn:Definition'] = require('./Definition');
module.exports.Process = activityTypes['bpmn:Process'] = require('./activities/BaseProcess');

activityTypes['bpmn:SequenceFlow'] = require('./activities/SequenceFlow');
activityTypes['bpmn:MessageFlow'] = require('./activities/MessageFlow');

activityTypes['bpmn:IntermediateCatchEvent'] = require('./activities/IntermediateCatchEvent');
activityTypes['bpmn:BoundaryEvent'] = require('./activities/BoundaryEvent');

activityTypes['bpmn:ExclusiveGateway'] = require('./gateways/ExclusiveGateway');
activityTypes['bpmn:ParallelGateway'] = require('./gateways/ParallelGateway');
activityTypes['bpmn:InclusiveGateway'] = require('./gateways/InclusiveGateway');

activityTypes['bpmn:Task'] = require('./tasks/Task');
activityTypes['bpmn:UserTask'] = require('./tasks/UserTask');
activityTypes['bpmn:SubProcess'] = require('./tasks/SubProcess');
activityTypes['bpmn:ScriptTask'] = require('./tasks/ScriptTask');
activityTypes['bpmn:ServiceTask'] = require('./tasks/ServiceTask');

activityTypes['bpmn:StartEvent'] = require('./events/StartEvent');
activityTypes['bpmn:EndEvent'] = require('./events/EndEvent');
activityTypes['bpmn:TimerEventDefinition'] = require('./events/TimerEvent');
activityTypes['bpmn:ErrorEventDefinition'] = require('./events/ErrorEvent');
activityTypes['bpmn:MessageEventDefinition'] = require('./events/MessageEvent');

activityTypes['bpmn:MultiInstanceLoopCharacteristics'] = require('./activities/MultiInstanceLoopCharacteristics');
activityTypes['bpmn:DataObjectReference'] = require('./activities/Dummy');
activityTypes['bpmn:DataObject'] = require('./activities/Dummy');

module.exports.ActivityIO = activityTypes ['camunda:inputOutput'] = require('./activities/InputOutput');
module.exports.Form = activityTypes['camunda:formData'] = require('./activities/Form');
module.exports.ServiceConnector = activityTypes['camunda:Connector'] = require('./activities/ServiceConnector');
