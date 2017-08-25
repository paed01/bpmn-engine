'use strict';

const ContextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:context');
const Environment = require('./Environment');
const expressions = require('./expressions');
const IoMapper = require('./io-mapper');
const mapper = require('./mapper');
const Path = require('path');

function Context(processId, moddleContext, environment) {
  const id = processId;
  const type = 'context';
  const activity = moddleContext.elementsById[id];

  environment = environment || Environment();
  const contextHelper = ContextHelper(moddleContext);
  const activities = contextHelper.getActivities(id);
  const children = {}, messageFlows = [], sequenceFlows = [];
  const ioMapper = IoMapper(contextHelper, environment);

  // const dataObjects = DataObjects(contextHelper.getDataObjects(), contextHelper.getDataObjectReferences(), environment);

  let childCount;

  const contextApi = {
    id,
    type,
    activity,
    childCount,
    children,
    contextHelper,
    dataObjects: ioMapper.dataObjects,
    environment,
    messageFlows,
    moddleContext,
    sequenceFlows,
    clone,
    getActivityForm,
    getActivityIO,
    getActivityIOReferences,
    getActivityProperties,
    getAttachedToActivity,
    getChildActivityById,
    getDefaultIO,
    getElementService,
    getFrozenVariablesAndServices,
    getInboundSequenceFlows,
    getOutboundSequenceFlows,
    getSequenceFlowTargetId,
    getServiceByName,
    getState,
    getSubContext,
    getVariablesAndServices,
    isDefaultSequenceFlow,
  };

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

  function getActivityIO(activityElement) {
    const io = contextHelper.getActivityIO(activityElement);
    if (!io) return getDefaultIO(activityElement);

    const ActivityIOType = ioMapper.fromType(io.$type);
    if (!ActivityIOType) return;

    return ActivityIOType(io, contextApi);
  }

  function getDefaultIO(activityElement) {
    const ActivityIOType = ioMapper.fromElement(activityElement);
    if (!ActivityIOType) return;
    return ActivityIOType(activityElement, contextApi);
  }

  function getActivityIOReferences(ioSpecification) {
    return contextHelper.getActivityIOReferences(ioSpecification);
  }

  function getActivityProperties(activityId) {
    const properties = contextHelper.getActivityProperties(activityId);
    if (!properties) return {};

    const activityProperties = new mapper.ActivityProperties(properties, contextApi);
    return activityProperties.getValues(getFrozenVariablesAndServices());
  }

  function getActivityForm(activityElement) {
    const formData = contextHelper.getActivityFormData(activityElement);
    if (!formData) return;
    const FormType = ioMapper.fromType(formData.$type);

    return new FormType(formData, contextApi);
  }

  function getState() {
    return {};
  }

  function getVariablesAndServices(override, freezeVariablesAndService) {
    return environment.getVariablesAndServices(override, freezeVariablesAndService);
  }

  function getFrozenVariablesAndServices(override) {
    return getVariablesAndServices(override, true);
  }

  function getElementService(element) {
    const contextService = contextHelper.getElementService(element);
    if (!contextService) return;
    if (contextService.connector) {
      return new (mapper(contextService.connector.$type))(contextService.connector, contextApi);
    }
    return new mapper.ServiceConnector(contextService, contextApi);
  }

  function getServiceByName(serviceName) {
    const serviceDef = environment.getServiceByName(serviceName);
    if (!serviceDef) return;
    return getService(serviceDef);
  }
}

module.exports = Context;

function Activity(activityElement, context) {
  const base = Object.assign({}, activityElement);

  const childId = activityElement.id;
  const type = activityElement.$type;
  const environment = context.environment;
  const {loopCharacteristics} = activityElement;

  const form = context.getActivityForm(activityElement);
  const inbound = context.getInboundSequenceFlows(childId);
  const io = context.getActivityIO(activityElement);
  const loop = loopCharacteristics && mapper(loopCharacteristics.$type)(loopCharacteristics);
  const outbound = context.getOutboundSequenceFlows(childId);
  const properties = context.getActivityProperties(childId);
  const terminate = context.contextHelper.isTerminationElement(activityElement);
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
      return context.getActivityIO(eventDefinition);
    }
  }
}

function getService(serviceDef) {
  let module;
  if (typeof serviceDef === 'function') {
    return serviceDef;
  } else if (!serviceDef.module) {
    return module;
  } else if (!serviceDef.type || serviceDef.type === 'require') {
    module = require(getRelativePath(serviceDef.module));
  } else { // global
    module = serviceDef.module === 'require' ? require : global[serviceDef.module];
  }

  if (serviceDef.fnName) {
    module = module[serviceDef.fnName];
  }

  return module;
}

function getRelativePath(module) {
  if (!module.startsWith('.')) return module;
  return Path.relative(__dirname, Path.join(process.cwd(), module));
}

