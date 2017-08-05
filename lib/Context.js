'use strict';

const ActivityIO = require('./io/ActivityIO');
const ContextHelper = require('./context-helper');
const DataObjects = require('./io/DataObjects');
const debug = require('debug')('bpmn-engine:context');
const expressions = require('./expressions');
const mapper = require('./mapper');
const Path = require('path');
const scriptHelper = require('./script-helper');
const Environment = require('./Environment');

function Context(processId, moddleContext, environment) {
  const id = processId;
  const type = 'context';
  const activity = moddleContext.elementsById[id];

  environment = environment || Environment();
  const contextHelper = ContextHelper(moddleContext);
  const activities = contextHelper.getActivities(id);
  const children = {}, messageFlows = [], sequenceFlows = [];
  const dataObjects = DataObjects(contextHelper.getDataObjects(), contextHelper.getDataObjectReferences(), environment);

  let childCount;

  const contextApi = {
    id,
    type,
    activity,
    childCount,
    children,
    contextHelper,
    dataObjects,
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
    return sequenceFlows.filter((sf) => sf.activity.id === activityId);
  }

  function getInboundSequenceFlows(activityId) {
    return sequenceFlows.filter((sf) => !sf.outboundMessage && sf.targetId === activityId);
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

  function getActivityIO(activityId) {
    const io = contextHelper.getActivityIO(activityId);
    if (!io) return getDefaultIO(activityId);

    const ActivityIOType = mapper(io.$type);
    return ActivityIOType(io, contextApi);
  }

  function getDefaultIO(activityId) {
    return ActivityIO(contextHelper.getActivityById(activityId), contextApi);
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
    const FormType = mapper(formData.$type);

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

function Activity(childActivity, context) {
  const base = Object.assign({}, childActivity);

  const childId = childActivity.id;
  const type = childActivity.$type;
  const environment = context.environment;

  const form = context.getActivityForm(childActivity);
  const inbound = context.getInboundSequenceFlows(childId);
  const io = context.getActivityIO(childId);
  const loop = getLoopCharacteristics(childActivity.loopCharacteristics);
  const outbound = context.getOutboundSequenceFlows(childId);
  const properties = context.getActivityProperties(childId);
  const terminate = context.contextHelper.isTerminationElement(childActivity);
  const getVariablesAndServices = context.environment.getVariablesAndServices;
  const resolveExpression = context.environment.resolveExpression;

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
    getSubContext: context.getSubContext.bind(context),
    getScript,
    getServiceDefinition,
    getVariablesAndServices,
    resolveExpression
  });

  return child;

  function getScript() {
    return {
      body: childActivity.script,
      scriptFormat: childActivity.scriptFormat
    };
  }

  function getServiceDefinition() {
    if (childActivity.expression) {
      return getServiceByExpression();
    }

    return context.getElementService(childActivity);
  }

  function getAttachedToActivity() {
    return context.getAttachedToActivity(childId);
  }

  function getServiceByExpression() {
    const fnExpression = childActivity.expression;
    return {
      name: fnExpression,
      type: 'expression',
      value: fnExpression,
      resultVariable: childActivity.resultVariable,
      execute: (executeOnBehalfOf, message, callback) => {
        const serviceFn = expressions(fnExpression, getVariablesAndServices());
        if (typeof serviceFn !== 'function') return callback(new Error(`<${childId}> Service expression ${fnExpression} did not resolve to a function`));

        serviceFn(message, function(err) {
          const args = Array.prototype.slice.call(arguments, 1);
          callback(err, args);
        });
      }
    };
  }

  function getEventDefinitions() {
    if (eventDefinitions) return eventDefinitions;

    if (!childActivity.eventDefinitions) {
      eventDefinitions = [];
    } else {
      eventDefinitions = childActivity.eventDefinitions.map(EventDefinition);
    }
    return eventDefinitions;
  }

  function EventDefinition(eventDefinition) {
    return {
      id: eventDefinition.id,
      type: eventDefinition.$type,
      cancelActivity: childActivity.hasOwnProperty('cancelActivity') ? childActivity.cancelActivity : true,
      errorCodeVariable: eventDefinition.errorCodeVariable,
      errorMessageVariable: eventDefinition.errorMessageVariable,
      timeDuration: eventDefinition.timeDuration && eventDefinition.timeDuration.body,
      getErrorRef
    };

    function getErrorRef(errorId) {
      if (!errorId) {
        errorId = (context.contextHelper.getErrorByReference(eventDefinition) || {}).id;
      }
      if (!errorId) return;

      const errorActivity = Activity(context.contextHelper.getActivityById(errorId), context);
      return mapper(errorActivity.type)(errorActivity);
    }
  }
}

function getLoopCharacteristics(loopCharacteristics) {
  if (!loopCharacteristics) return;

  const characteristics = {
    isSequential: loopCharacteristics.isSequential
  };

  if (loopCharacteristics.collection) {
    characteristics.type = 'collection';
    characteristics.collection = loopCharacteristics.collection;
    characteristics.hasCollection = true;
  }

  if (loopCharacteristics.completionCondition && loopCharacteristics.completionCondition.body) {
    if (expressions.isExpression(loopCharacteristics.completionCondition.body)) {
      characteristics.conditionExpression = loopCharacteristics.completionCondition.body;
    } else {
      characteristics.condition = scriptHelper.parse('characteristics.condition', loopCharacteristics.completionCondition.body);
    }
    characteristics.type = characteristics.type || 'condition';
    characteristics.hasCondition = true;
  }

  if (loopCharacteristics.loopCardinality && loopCharacteristics.loopCardinality.body) {
    if (expressions.isExpression(loopCharacteristics.loopCardinality.body)) {
      characteristics.cardinalityExpression = loopCharacteristics.loopCardinality.body;
    } else {
      const cardinality = Number(loopCharacteristics.loopCardinality.body);
      if (!isNaN(cardinality)) {
        characteristics.cardinality = cardinality;
      }
    }

    if ((characteristics.cardinalityExpression || !isNaN(characteristics.cardinality))) {
      characteristics.hasCardinality = true;
      characteristics.type = characteristics.type || 'cardinality';
    }
  }

  return characteristics;
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

