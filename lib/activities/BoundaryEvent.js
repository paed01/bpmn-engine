'use strict';

const mapper = require('../mapper');

function BoundaryEvent(activity) {
  const ctorArgs = Array.prototype.slice.call(arguments);
  const Type = mapper(activity.eventDefinitions[0].$type);
  const event = new (Function.prototype.bind.apply(Type, [null].concat(ctorArgs)))();
  return event;
}

module.exports = BoundaryEvent;
