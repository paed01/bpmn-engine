'use strict';

const BpmnError = require('./activities/BpmnError');
const Definition = require('./definition');
const ErrorEventDefinition = require('./eventDefinitions/ErrorEventDefinition');
const MessageEventDefinition = require('./eventDefinitions/MessageEventDefinition');
const MultiInstanceLoopCharacteristics = require('./extensions/MultiInstanceLoopCharacteristics');
const MessageFlow = require('./flows/MessageFlow');
const SequenceFlow = require('./flows/SequenceFlow');
const SignalTask = require('./tasks/SignalTask');
const Task = require('./tasks/Task');
const TerminateEventDefinition = require('./eventDefinitions/TerminateEventDefinition');
const TimerEventDefinition = require('./eventDefinitions/TimerEventDefinition');
const UserTask = require('./tasks/UserTask');

const activityTypes = {};

activityTypes['bpmn:Error'] = BpmnError;
activityTypes['bpmn:ErrorEventDefinition'] = ErrorEventDefinition;
activityTypes['bpmn:MessageEventDefinition'] = MessageEventDefinition;
activityTypes['bpmn:TimerEventDefinition'] = TimerEventDefinition;
activityTypes['bpmn:TerminateEventDefinition'] = TerminateEventDefinition;

module.exports = function fromType(type) {
  const activityType = activityTypes[type];

  if (!activityType) {
    throw new Error(`Unknown activity type ${type}`);
  }

  return activityType;
};


activityTypes['bpmn:MultiInstanceLoopCharacteristics'] = MultiInstanceLoopCharacteristics;

activityTypes['bpmn:ManualTask'] = SignalTask;
activityTypes['bpmn:ReceiveTask'] = SignalTask;
activityTypes['bpmn:SendTask'] = Task;
activityTypes['bpmn:Task'] = Task;
activityTypes['bpmn:UserTask'] = UserTask;

activityTypes['bpmn:SequenceFlow'] = SequenceFlow;
activityTypes['bpmn:MessageFlow'] = MessageFlow;

module.exports.isTask = function(type) {
  if (!type) return false;
  return /task$/i.test(type);
};

module.exports.Definition = activityTypes['bpmn:Definition'] = Definition;
module.exports.Process = activityTypes['bpmn:Process'] = require('./process');

activityTypes['bpmn:IntermediateCatchEvent'] = require('./events/IntermediateCatchEvent');
activityTypes['bpmn:BoundaryEvent'] = require('./events/BoundaryEvent');

activityTypes['bpmn:ExclusiveGateway'] = require('./gateways/ExclusiveGateway');
activityTypes['bpmn:ParallelGateway'] = require('./gateways/ParallelGateway');
activityTypes['bpmn:InclusiveGateway'] = require('./gateways/InclusiveGateway');

activityTypes['bpmn:SubProcess'] = require('./tasks/SubProcess');
activityTypes['bpmn:ScriptTask'] = require('./tasks/ScriptTask');
activityTypes['bpmn:ServiceTask'] = require('./tasks/ServiceTask');

activityTypes['bpmn:StartEvent'] = require('./events/StartEvent');
activityTypes['bpmn:EndEvent'] = require('./events/EndEvent');

activityTypes['bpmn:DataObjectReference'] = require('./activities/Dummy');
activityTypes['bpmn:DataObject'] = require('./activities/Dummy');
