'use strict';

const ContextHelper = require('./context-helper');
const DataObjects = require('./io/DataObjects');
const debug = require('debug')('bpmn-engine:context');
const Environment = require('./Environment');
const expressions = require('./expressions');
const ExtensionsMapper = require('./extensions-mapper');
const mapper = require('./mapper');

function Context(processId, moddleContext, environment) {
  const id = processId;
  const type = 'context';
  const activity = moddleContext.elementsById[id];

  environment = environment || Environment();
  const contextHelper = ContextHelper(moddleContext);
  const activities = contextHelper.getActivities(id);
  const children = {}, messageFlows = [], sequenceFlows = [];
  let childCount, dataObjects;

  const contextApi = {
    id,
    type,
    activity,
    childCount,
    children,
    contextHelper,
    environment,
    messageFlows,
    moddleContext,
    sequenceFlows,
    clone,
    getActivityExtensions,
    getActivityIOReferences,
    getActivityProperties,
    getAttachedToActivity,
    getChildActivityById,
    getDataObjects,
    getElementService,
    getInboundSequenceFlows,
    getOutboundSequenceFlows,
    getSequenceFlowTargetId,
    getSubContext,
    isDefaultSequenceFlow,
  };

  const extensionsMapper = ExtensionsMapper(contextApi);

  loadSequenceFlows();
  loadChildren();

  return contextApi;

  function loadSequenceFlows() {
    return contextHelper.getAllOutboundSequenceFlows(id).map((sf) => {
      const Flow = mapper(sf.element.$type);
      const flow = new Flow(sf, contextApi);

      sequenceFlows.push(flow);
      if (flow.outboundMessage) {
        messageFlows.push(flow);
      }
    });
  }

  function loadChildren() {
    debug(`<${id}> load children`);

    activities.forEach((childActivity) => {
      const child = createChildById(childActivity.id, contextApi);
      if (child.placeholder) return;
      children[child.id] = child;
      ++childCount;
    });
  }

  function createChildById(childId, context, options) {
    const activityDefinition = moddleContext.elementsById[childId];

    const childArg = Activity(activityDefinition, contextApi);

    const ChildActivity = mapper(childArg.type);
    return new ChildActivity(childArg, context, options);
  }

  function getSubContext(childId, subEnvironment) {
    return Context(childId, moddleContext, subEnvironment || environment);
  }

  function clone(environmentOverride) {
    return Context(id, moddleContext, environmentOverride || environment);
  }

  function getOutboundSequenceFlows(activityId) {
    return sequenceFlows.filter(({sourceId}) => sourceId === activityId);
  }

  function getInboundSequenceFlows(activityId) {
    return sequenceFlows.filter(({outboundMessage, targetId}) => !outboundMessage && targetId === activityId);
  }

  function isDefaultSequenceFlow(sequenceFlowId) {
    return contextHelper.isDefaultSequenceFlow(sequenceFlowId);
  }

  function getSequenceFlowTargetId(sequenceFlowId) {
    return contextHelper.getSequenceFlowTargetId(sequenceFlowId);
  }

  function getAttachedToActivity(eventId) {
    const attachedTo = contextHelper.getAttachedToActivity(eventId);
    if (!attachedTo) return;

    return getChildActivityById(attachedTo.id);
  }

  function getChildActivityById(activityId) {
    return children[activityId];
  }

  function getActivityExtensions(activityElement) {
    return extensionsMapper.get(activityElement);
  }

  function getDataObjects() {
    if (dataObjects) return dataObjects;
    dataObjects = DataObjects(contextHelper.getDataObjects(), contextHelper.getDataObjectReferences(), environment);
    return dataObjects;
  }

  function getActivityIOReferences(ioSpecification) {
    return contextHelper.getActivityIOReferences(ioSpecification);
  }

  function getActivityProperties(activityId) {
    const properties = contextHelper.getActivityProperties(activityId);
    if (!properties) return {};

    const activityProperties = new mapper.ActivityProperties(properties, contextApi);
    return activityProperties.getValues(environment.getFrozenVariablesAndServices());
  }

  function getElementService(element) {
    const contextService = contextHelper.getElementService(element);
    if (!contextService) return;
    if (contextService.connector) {
      return new (mapper(contextService.connector.$type))(contextService.connector, contextApi);
    }
    return new mapper.ServiceConnector(contextService, contextApi);
  }
}

module.exports = Context;

function Activity(activityElement, context) {
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
  const terminate = contextHelper.isTerminationElement(activityElement);
  const getVariablesAndServices = environment.getVariablesAndServices;
  const resolveExpression = environment.resolveExpression;

  const isStart = inbound.length === 0;

  let eventDefinitions;

  const child = Object.assign(base, {
    environment,
    type,
    form,
    inbound,
    io,
    isStart,
    loop,
    outbound,
    properties,
    terminate,
    getAttachedToActivity,
    getEventDefinitions,
    getSubContext: (...args) => context.getSubContext(...args),
    getScript,
    getServiceDefinition,
    getVariablesAndServices,
    resolveExpression
  });

  return child;

  function getScript() {
    return {
      body: activityElement.script,
      scriptFormat: activityElement.scriptFormat
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
        errorId = (context.contextHelper.getErrorByReference(eventDefinition) || {}).id;
      }
      if (!errorId) return;

      const errorActivity = Activity(context.contextHelper.getActivityById(errorId), context);
      return mapper(errorActivity.type)(errorActivity);
    }

    function getIO() {
      return context.getActivityExtensions(eventDefinition).io;
    }
  }
}
