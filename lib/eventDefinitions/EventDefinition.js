'use strict';

const ErrorEventDefinition = require('./ErrorEventDefinition');
const MessageEventDefinition = require('./MessageEventDefinition');
const TerminateEventDefinition = require('./TerminateEventDefinition');
const TimerEventDefinition = require('./TimerEventDefinition');

const eventDefinitionTypes = {};
eventDefinitionTypes['bpmn:ErrorEventDefinition'] = ErrorEventDefinition;
eventDefinitionTypes['bpmn:MessageEventDefinition'] = MessageEventDefinition;
eventDefinitionTypes['bpmn:TimerEventDefinition'] = TimerEventDefinition;
eventDefinitionTypes['bpmn:TerminateEventDefinition'] = TerminateEventDefinition;

module.exports = function EventDefinition(activityElement, eventDefinition, parentContext) {
  const Type = eventDefinitionTypes[eventDefinition.$type];
  if (!Type) return;
  return Type(activityElement, eventDefinition, parentContext);
};
