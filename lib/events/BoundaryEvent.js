'use strict';

const mapper = require('../mapper');

const internals = {};

module.exports = internals.BoundaryEvent = function(activity, parentContext) {
  const ctorArgs = Array.prototype.slice.call(arguments);
  const Type = mapper(activity.eventDefinitions[0].$type);
  const event = new (Function.prototype.bind.apply(Type, [null].concat(ctorArgs)))();
  event.isStart = false;
  event.attachedTo = parentContext.getAttachedToActivity(event.id);
  return event;
};
