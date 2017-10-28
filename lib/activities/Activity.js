'use strict';

const ActivityIo = require('../io/ActivityIo');
const EventDefinition = require('../eventDefinitions/EventDefinition');
const MultiInstanceLoopCharacteristics = require('../extensions/MultiInstanceLoopCharacteristics');

module.exports = function Activity(activityElement, parentContext) {
  const base = Object.assign({}, activityElement);
  const {id: childId, $type: type, eventDefinitions, loopCharacteristics} = base;

  const {environment} = parentContext;
  const inbound = parentContext.getInboundSequenceFlows(childId);
  const outbound = parentContext.getOutboundSequenceFlows(childId);

  const io = ActivityIo(activityElement, parentContext);
  const loop = loopCharacteristics && MultiInstanceLoopCharacteristics(loopCharacteristics, parentContext);

  const getVariablesAndServices = environment.getVariablesAndServices;
  const resolveExpression = environment.resolveExpression;

  const isStart = inbound.length === 0;

  let loadedEventDefinitions;

  const childBaseApi = Object.assign(base, {
    environment,
    type,
    form: io.form,
    inbound,
    io,
    isStart,
    loop,
    outbound,
    getAttachedToActivity,
    getEventDefinitions,
    getSubContext: (...args) => parentContext.getSubContext(...args),
    getScript,
    getService,
    getVariablesAndServices,
    resolveExpression
  });

  return childBaseApi;

  function getScript() {
    const {script: body, scriptFormat} = activityElement;
    return {
      body,
      scriptFormat
    };
  }

  function getService() {
    return parentContext.getService(activityElement);
  }

  function getAttachedToActivity() {
    return parentContext.getAttachedToActivity(childId);
  }

  function getEventDefinitions() {
    if (loadedEventDefinitions) return loadedEventDefinitions;

    if (!eventDefinitions) {
      loadedEventDefinitions = [];
    } else {
      loadedEventDefinitions = eventDefinitions.reduce((result, ed) => {
        const eventDefinition = EventDefinition(activityElement, ed, parentContext);
        if (eventDefinition) result.push(eventDefinition);
        return result;
      }, []);
    }

    return loadedEventDefinitions;
  }
};
