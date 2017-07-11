'use strict';

const ContextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:context');
const expressions = require('./expressions');
const mapper = require('./mapper');
const Path = require('path');
const scriptHelper = require('./script-helper');
const Environment = require('./Environment');

function Context(processId, moddleContext, environment) {
  this.id = processId;
  this.moddleContext = moddleContext;
  this.contextHelper = ContextHelper(moddleContext);

  this.environment = environment || Environment();
  this.activity = moddleContext.elementsById[processId];
  this.type = this.activity.$type;

  loadSequenceFlows.call(this, this.id);
  loadChildren.call(this, this.id);
}

module.exports = Context;

function Activity(childActivity, context) {
  const base = Object.assign({}, childActivity);

  const childId = childActivity.id;
  const type = childActivity.$type;
  const environment = context.environment;

  const form = context.getActivityForm(childActivity);
  const hasInboundMessage = !!context.getInboundMessageFlows(childId).length;
  const inbound = context.getInboundSequenceFlows(childId);
  const io = context.getActivityIO(childId);
  const loop = getLoopCharacteristics(childActivity.loopCharacteristics);
  const outbound = context.getOutboundSequenceFlows(childId);
  const properties = context.getActivityProperties(childId);
  const terminate = context.contextHelper.isTerminationElement(childActivity);
  const getVariablesAndServices = context.environment.getVariablesAndServices;
  const resolveExpression = context.environment.resolveExpression;

  let eventDefinitions;

  const child = Object.assign(base, {
    environment,
    type,
    form,
    hasInboundMessage,
    inbound,
    io,
    loop,
    outbound,
    properties,
    terminate,
    getAttachedToActivity,
    getEventDefinitions,
    getLoopCharacteristics,
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

Context.prototype.getSubContext = function(childId, environment) {
  return new Context(childId, this.moddleContext, environment || this.environment);
};

Context.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

Context.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => !sf.outboundMessage && sf.targetId === activityId);
};

Context.prototype.getInboundMessageFlows = function(activityId) {
  return this.contextHelper.getInboundMessageFlows(activityId);
};

Context.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return this.contextHelper.isDefaultSequenceFlow(sequenceFlowId);
};

Context.prototype.getSequenceFlowTargetId = function(sequenceFlowId) {
  return this.contextHelper.getSequenceFlowTargetId(sequenceFlowId);
};

Context.prototype.hasAttachedErrorEvent = function(activityId) {
  return this.contextHelper.hasAttachedErrorEvent(activityId);
};

Context.prototype.getAttachedToActivity = function(eventId) {
  const attachedTo = this.contextHelper.getAttachedToActivity(eventId);
  if (!attachedTo) return;

  return this.getChildActivityById(attachedTo.id);
};

Context.prototype.getChildActivityById = function(activityId) {
  let child = this.children[activityId];
  if (!child) {
    if (!this.activities.some((a) => a.id === activityId)) return child;

    child = createChildById.call(this, activityId, this);
    this.children[activityId] = child;
  }
  return child;
};

Context.prototype.saveChildOutput = function(childId, output) {
  debug(`<${this.id}>`, `save <${childId}> output`, output);

  const dataObjects = this.contextHelper.getChildOutputNames(childId);
  if (dataObjects.length) {
    dataObjects.forEach((dataObject) => {
      debug(`<${this.id}>`, `setting data from <${childId}> to variables["${dataObject.id}"]`);
      this.variables[dataObject.id] = output;
    });
  } else {
    debug(`<${this.id}>`, `setting data from <${childId}> to variables.taskInput["${childId}"]`);
    if (!this.variables.taskInput) this.variables.taskInput = {};
    this.variables.taskInput[childId] = output;
  }
};

Context.prototype.getActivityInputOutput = function(activity) {
  return this.contextHelper.getActivityInputOutput(activity);
};

Context.prototype.getActivityIO = function(activityId) {
  const io = this.contextHelper.getActivityIO(activityId);
  if (!io) return;
  return new mapper.ActivityIO(io, this);
};

Context.prototype.getActivityProperties = function(activityId) {
  const properties = this.contextHelper.getActivityProperties(activityId);
  if (!properties) return {};

  const activityProperties = new mapper.ActivityProperties(properties, this);
  return activityProperties.getValues(this.getFrozenVariablesAndServices());
};

Context.prototype.getActivityForm = function(activity) {
  if (!activity) return;
  const formData = this.contextHelper.getActivityFormData(activity);
  if (!formData) return;
  return new mapper.Form(formData, this);
};

Context.prototype.applyMessage = function(message) {
  Object.assign(this.variables, message);
};

Context.prototype.applyExecutionContext = function(input) {
  if (!input) return;
  const extraVariables = Object.assign({}, input);

  delete extraVariables.variables;
  delete extraVariables.services;

  Object.assign(this.variables, input.variables, extraVariables);
  Object.assign(this.services, input.services);
};

Context.prototype.getLoopCharacteristics = function(loopCharacteristics) {
  if (!loopCharacteristics) return;
  return new (mapper(loopCharacteristics.$type))(loopCharacteristics, this);
};

Context.prototype.getState = function() {
  const variables = JSON.parse(JSON.stringify(this.variablesAndServices));
  return {
    variablesAndServices: variables
  };
};

Context.prototype.getPendingActivities = function() {
  return getEnteredChildStates(this.children);
};

Context.prototype.getVariablesAndServices = function(override, freezeVariablesAndService) {
  return this.environment.getVariablesAndServices(override, freezeVariablesAndService);
};

Context.prototype.getFrozenVariablesAndServices = function(override) {
  return this.getVariablesAndServices(override, true);
};

Context.prototype.resume = function(state) {
  this.variablesAndServices = state.variablesAndServices;
};

Context.prototype.getElementService = function(element) {
  const contextService = this.contextHelper.getElementService(element);
  if (!contextService) return;
  if (contextService.connector) {
    return new (mapper(contextService.connector.$type))(contextService.connector, this);
  }
  return new mapper.ServiceConnector(contextService, this);
};

Context.prototype.getServiceByName = function(serviceName) {
  const serviceDef = this.environment.getServiceByName(serviceName);
  if (!serviceDef) return;
  return getService(serviceDef);
};

Context.prototype.getErrorEventDefinition = function(activity) {
  return this.contextHelper.getActivityErrorEventDefinition(activity);
};

function getServices(services) {
  return Object.keys(services).reduce((result, serviceName) => {
    const serviceDef = services[serviceName];
    result[serviceName] = getService(serviceDef);
    return result;
  }, {});
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

function loadSequenceFlows(scopeId) {
  this.sequenceFlows = [];
  this.messageFlows = [];
  return this.contextHelper.getAllOutboundSequenceFlows(scopeId).map((sf) => {
    const Flow = mapper(sf.element.$type);
    const flow = new Flow(sf, this);

    this.sequenceFlows.push(flow);
    if (flow.outboundMessage) {
      this.messageFlows.push(flow);
    }
  });
}

function loadChildren(scopeId) {
  debug(`<${this.id}>`, 'load children');
  this.children = {};
  this.startActivities = [];
  this.endActivities = [];
  this.childCount = 0;
  this.activities = this.contextHelper.getActivities(scopeId);
  this.activities.forEach((activity) => {
    let child = this.children[activity.id];

    if (!child) {
      child = createChildById.call(this, activity.id, this);
      if (child.placeholder) return;
      this.children[child.id] = child;
      this.childCount++;
    }

    if (child.isStart) this.startActivities.push(child);
    if (child.isEnd) this.endActivities.push(child);
  });
}

function createChildById(id, context, options) {
  const activityDefinition = this.moddleContext.elementsById[id];

  const activity = Activity(activityDefinition, this);

  const ChildActivity = mapper(activity.type);
  return new ChildActivity(activity, context, options);
}

function getChildStates(children) {
  return Object.keys(children).reduce((result, childKey) => {
    result.push(children[childKey].getState());
    return result;
  }, []);
}

function getEnteredChildStates(children) {
  return Object.keys(children).reduce((result, childKey) => {
    const child = children[childKey];
    if (child.entered) {
      result.push(child.getState());
    }
    return result;
  }, []);
}


