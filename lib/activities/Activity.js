'use strict';

const expressions = require('../expressions');
const mapper = require('../mapper');

module.exports = function Activity(activityElement, context) {
  const base = Object.assign({}, activityElement);

  const {contextHelper, environment} = context;

  const childId = activityElement.id;
  const type = activityElement.$type;
  const {loopCharacteristics} = activityElement;

  const inbound = context.getInboundSequenceFlows(childId);
  const {io, form} = context.getActivityExtensions(activityElement);

  const loop = loopCharacteristics && mapper(loopCharacteristics.$type)(loopCharacteristics);
  const outbound = context.getOutboundSequenceFlows(childId);
  const properties = context.getActivityProperties(childId);
  const getVariablesAndServices = environment.getVariablesAndServices;
  const resolveExpression = environment.resolveExpression;

  const isStart = inbound.length === 0;

  let eventDefinitions;

  const childBaseApi = Object.assign(base, {
    environment,
    type,
    form,
    inbound,
    io,
    isStart,
    loop,
    outbound,
    properties,
    getAttachedToActivity,
    getEventDefinitions,
    getSubContext: (...args) => context.getSubContext(...args),
    getScript,
    getServiceDefinition,
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

  function getServiceDefinition() {
    if (activityElement.expression) {
      return getServiceByExpression();
    }

    return context.getElementService(activityElement);
  }

  function getAttachedToActivity() {
    return context.getAttachedToActivity(childId);
  }

  function getServiceByExpression() {
    const fnExpression = activityElement.expression;
    return {
      name: fnExpression,
      type: 'expression',
      value: fnExpression,
      resultVariable: activityElement.resultVariable,
      execute: (executeOnBehalfOf, message, callback) => {
        const serviceFn = expressions(fnExpression, getVariablesAndServices());
        if (typeof serviceFn !== 'function') return callback(new Error(`<${childId}> Service expression ${fnExpression} did not resolve to a function`));

        serviceFn(message, (err, ...args) => {
          callback(err, args);
        });
      }
    };
  }

  function getEventDefinitions() {
    if (eventDefinitions) return eventDefinitions;

    if (!activityElement.eventDefinitions) {
      eventDefinitions = [];
    } else {
      eventDefinitions = activityElement.eventDefinitions.map(EventDefinition);
    }
    return eventDefinitions;
  }

  function EventDefinition(eventDefinition) {
    const edId = eventDefinition.id;
    return Object.assign({}, eventDefinition, {
      id: edId,
      type: eventDefinition.$type,
      cancelActivity: activityElement.hasOwnProperty('cancelActivity') ? activityElement.cancelActivity : true,
      getIO,
      getErrorRef
    });

    function getErrorRef(errorId) {
      if (!errorId) {
        errorId = (contextHelper.getErrorByReference(eventDefinition) || {}).id;
      }
      if (!errorId) return;

      const errorActivity = Activity(contextHelper.getActivityById(errorId), context);
      return mapper(errorActivity.type)(errorActivity);
    }

    function getIO() {
      return context.getActivityExtensions(eventDefinition).io;
    }
  }
};
