'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:context');
const mapper = require('./mapper');
const Path = require('path');

function Context(processId, moddleContext, options) {
  this.id = processId;
  this.moddleContext = moddleContext;
  this.options = options || {};
  this.variables = Object.assign({}, this.options.variables);

  this.services = Object.assign({}, this.options.services);
  loadSequenceFlows.call(this, this.id);
  loadChildren.call(this, this.id);
}

Context.prototype.getOutboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => sf.activity.id === activityId);
};

Context.prototype.getInboundSequenceFlows = function(activityId) {
  return this.sequenceFlows.filter((sf) => !sf.outboundMessage && sf.targetId === activityId);
};

Context.prototype.isDefaultSequenceFlow = function(sequenceFlowId) {
  return contextHelper.isDefaultSequenceFlow(this.moddleContext, sequenceFlowId);
};

Context.prototype.getSequenceFlowTargetId = function(sequenceFlowId) {
  return contextHelper.getSequenceFlowTargetId(this.moddleContext, sequenceFlowId);
};

Context.prototype.hasAttachedErrorEvent = function(activityId) {
  return contextHelper.hasAttachedErrorEvent(this.moddleContext, activityId);
};

Context.prototype.getAttachedToActivity = function(eventId) {
  const attachedTo = contextHelper.getAttachedToActivity(this.moddleContext, eventId);
  if (!attachedTo) return;

  return this.getChildActivityById(attachedTo.id);
};

Context.prototype.getChildActivityById = function(activityId) {
  let child = this.children[activityId];
  if (!child) {
    if (!this.activities.some((a) => a.id === activityId)) return child;

    child = createChildById.call(this, activityId, this, this.options);
    this.children[activityId] = child;
  }
  return child;
};

Context.prototype.saveChildOutput = function(childId, output) {
  debug(`<${this.id}>`, `save <${childId}> output`, output);

  const dataObjects = contextHelper.getChildOutputNames(this.moddleContext, childId);
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

Context.prototype.getActivityIO = function(activityId) {
  const io = contextHelper.getActivityIO(this.moddleContext, activityId);
  if (!io) return;
  return new mapper.ActivityIO(io, this);
};

Context.prototype.getActivityProperties = function(activityId) {
  const properties = contextHelper.getActivityProperties(this.moddleContext, activityId);
  if (!properties) return {};

  const activityProperties = new mapper.ActivityProperties(properties, this);
  return activityProperties.getValues(this.getFrozenVariablesAndServices());
};

Context.prototype.getActivityForm = function(activity) {
  if (!activity) return;
  const formData = contextHelper.getActivityFormData(activity);
  if (!formData) return;
  return new mapper.Form(formData, this);
};

Context.prototype.applyMessage = function(message) {
  Object.assign(this.variables, message);
};

Context.prototype.getLoopCharacteristics = function(loopCharacteristics) {
  if (!loopCharacteristics) return;
  return new (mapper(loopCharacteristics.$type))(loopCharacteristics, this);
};

Context.prototype.getState = function() {
  return {
    variables: JSON.parse(JSON.stringify(this.variables)),
    services: JSON.parse(JSON.stringify(this.services)),
    children: getChildStates(this.children)
  };
};

Context.prototype.getPendingActivities = function() {
  return getEnteredChildStates(this.children);
};

Context.prototype.getVariablesAndServices = function(options, freezeVariablesAndService) {
  const result = Object.assign(options || {}, {
    variables: this.variables,
    services: getServices(this.services)
  });

  if (freezeVariablesAndService) {
    result.variables = Object.freeze(Object.assign({}, result.variables));
    result.services = Object.freeze(Object.assign({}, result.services));
  }
  return result;
};

Context.prototype.getFrozenVariablesAndServices = function(options) {
  return this.getVariablesAndServices(options, true);
};

Context.prototype.resume = function(state) {
  this.variables = Object.assign({}, state.variables);
  this.services = Object.assign({}, state.services);
};

Context.prototype.getElementService = function(element) {
  const contextService = contextHelper.getElementService(element);
  if (!contextService) return;
  if (contextService.connector) {
    return new (mapper(contextService.connector.$type))(contextService.connector, this);
  }
  return new mapper.ServiceConnector(contextService, this);
};

Context.prototype.getServiceByName = function(serviceName) {
  const serviceDef = this.services[serviceName];
  if (!serviceDef) return;
  return getService(serviceDef);
};

Context.prototype.getErrorEventDefinition = function(activity) {
  return contextHelper.getActivityErrorEventDefinition(activity);
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
  } 
  // remove dynamic require to support react native 
  // else if (!serviceDef.type || serviceDef.type === 'require') {
  //   module = require(getRelativePath(serviceDef.module));
  // } else { // global
  //   module = serviceDef.module === 'require' ? require : global[serviceDef.module];
  // }

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
  return contextHelper.getAllOutboundSequenceFlows(this.moddleContext, scopeId).map((sf) => {
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
  this.activities = contextHelper.getActivities(this.moddleContext, scopeId);
  this.activities.forEach((activity) => {
    let child = this.children[activity.id];
    if (!child) {
      child = createChildById.call(this, activity.id, this, this.options);
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
  const ChildActivity = mapper(activityDefinition.$type);
  return new ChildActivity(activityDefinition, context, options);
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

module.exports = Context;
