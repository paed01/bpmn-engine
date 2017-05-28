'use strict';

const mapper = require('../mapper');

function BoundaryEvent(activity) {
  const ctorArgs = Array.prototype.slice.call(arguments);
  const eventDefinition = activity.getEventDefinitions()[0];
  activity.eventDefinition = eventDefinition;

  const Type = mapper(eventDefinition.type);
  const event = new (Function.prototype.bind.apply(Type, [null].concat(ctorArgs)))();

  return event;
}

module.exports = BoundaryEvent;
