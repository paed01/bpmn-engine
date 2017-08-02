'use strict';

const BpmnError = require('./activities/BpmnError');
const Definition = require('./Definition');
const ErrorEventDefinition = require('./eventDefinitions/ErrorEventDefinition');
const Form = require('./io/Form');
const InputOutput = require('./io/InputOutput');
const IoSpecification = require('./io/IoSpecification');
const MessageEventDefinition = require('./eventDefinitions/MessageEventDefinition');
const SignalTask = require('./tasks/SignalTask');
const Task = require('./tasks/Task');
const TerminateEventDefinition = require('./eventDefinitions/TerminateEventDefinition');
const TimerEventDefinition = require('./eventDefinitions/TimerEventDefinition');
const UserTask = require('./tasks/SignalTask');

const activityTypes = {};

module.exports = function fromType(type) {
  const activityType = activityTypes[type];

  if (!activityType) {
    throw new Error(`Unknown activity type ${type}`);
  }

  return activityType;
};

activityTypes['bpmn:Error'] = BpmnError;

activityTypes['bpmn:InputOutputSpecification'] = IoSpecification;
activityTypes['camunda:InputOutput'] = InputOutput;
activityTypes['camunda:FormData'] = Form;

activityTypes['bpmn:ErrorEventDefinition'] = ErrorEventDefinition;
activityTypes['bpmn:MessageEventDefinition'] = MessageEventDefinition;
activityTypes['bpmn:TimerEventDefinition'] = TimerEventDefinition;
activityTypes['bpmn:TerminateEventDefinition'] = TerminateEventDefinition;

activityTypes['bpmn:ManualTask'] = SignalTask;
activityTypes['bpmn:ReceiveTask'] = SignalTask;
activityTypes['bpmn:SendTask'] = Task;
activityTypes['bpmn:Task'] = Task;
activityTypes['bpmn:UserTask'] = UserTask;

module.exports.isTask = function(type) {
  if (!type) return false;
  return /task$/i.test(type);
};

module.exports.Definition = activityTypes['bpmn:Definition'] = Definition;
module.exports.Process = activityTypes['bpmn:Process'] = require('./activities/Process');

activityTypes['bpmn:SequenceFlow'] = require('./activities/SequenceFlow');
activityTypes['bpmn:MessageFlow'] = require('./activities/MessageFlow');

activityTypes['bpmn:IntermediateCatchEvent'] = require('./events/IntermediateCatchEvent');
activityTypes['bpmn:BoundaryEvent'] = require('./events/BoundaryEvent');

activityTypes['bpmn:ExclusiveGateway'] = require('./gateways/ExclusiveGateway');
activityTypes['bpmn:ParallelGateway'] = require('./gateways/ParallelGateway');
activityTypes['bpmn:InclusiveGateway'] = require('./gateways/InclusiveGateway');

// activityTypes['bpmn:SendTask'] = BaseTask;

activityTypes['bpmn:SubProcess'] = require('./tasks/SubProcess');
activityTypes['bpmn:ScriptTask'] = require('./tasks/ScriptTask');
activityTypes['bpmn:ServiceTask'] = require('./tasks/ServiceTask');

activityTypes['bpmn:StartEvent'] = require('./events/StartEvent');
activityTypes['bpmn:EndEvent'] = require('./events/EndEvent');
// activityTypes['bpmn:ErrorEventDefinition'] = require('./events/ErrorEvent');

activityTypes['bpmn:MultiInstanceLoopCharacteristics'] = require('./activities/MultiInstanceLoopCharacteristics');
activityTypes['bpmn:DataObjectReference'] = require('./activities/Dummy');
activityTypes['bpmn:DataObject'] = require('./activities/Dummy');


module.exports.ActivityProperties = activityTypes['camunda:properties'] = require('./activities/Properties');
// module.exports.Form = activityTypes['camunda:formData'] = require('./activities/Form');
module.exports.ServiceConnector = activityTypes['camunda:Connector'] = require('./activities/ServiceConnector');
