'use strict';

const ActivityIo = require('../io/ActivityIo');
const EventDefinition = require('../eventDefinitions/EventDefinition');
const MultiInstanceLoopCharacteristics = require('../extensions/MultiInstanceLoopCharacteristics');
const {EventEmitter} = require('events');

module.exports = function Activity(activityElement, parentContext) {
  const base = Object.assign(new EventEmitter(), activityElement);

  const {id: childId, $type: type, eventDefinitions, loopCharacteristics} = base;

  const {environment, getInboundSequenceFlows, getOutboundSequenceFlows} = parentContext;
  const inbound = getInboundSequenceFlows(childId);
  const outbound = getOutboundSequenceFlows(childId);

  const io = ActivityIo(activityElement, parentContext);
  const loop = loopCharacteristics && MultiInstanceLoopCharacteristics(loopCharacteristics, parentContext);

  const isStart = inbound.length === 0;

  let loadedEventDefinitions;

  const childBaseApi = Object.assign(base, {
    environment,
    type,
    form: io.form,
    inbound,
    outbound,
    io,
    isStart,
    loop,
    getEventDefinitions,
    getScript,
    getService
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
