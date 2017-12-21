'use strict';

const ActivityIo = require('../io/ActivityIo');
const EventDefinition = require('../eventDefinitions/EventDefinition');
const FlowManager = require('../flows/flow-manager');
const MultiInstanceLoopCharacteristics = require('../extensions/MultiInstanceLoopCharacteristics');
const {EventEmitter} = require('events');

module.exports = function Activity(activityElement, parentContext) {
  const base = Object.assign(new EventEmitter(), activityElement);

  const {id, $type: type, eventDefinitions, loopCharacteristics} = base;

  const {environment, getInboundSequenceFlows, getOutboundSequenceFlows} = parentContext;
  const inbound = getInboundSequenceFlows(id);
  const outbound = getOutboundSequenceFlows(id);

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
    getService,
    waitFor
  });

  childBaseApi.flows = FlowManager(childBaseApi, parentContext);

  return childBaseApi;

  function waitFor(eventName) {
    const prom = new Promise((resolve) => {
      childBaseApi.once(eventName, (...args) => {
        resolve(args);
      });
    });
    return prom;
  }

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
