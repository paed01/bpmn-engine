'use strict';

const pub = {};

pub.getProcesses = function(moddleContext) {
  return moddleContext.rootHandler.element.rootElements.filter((e) => e.$type === 'bpmn:Process');
};

pub.getExecutableProcessId = function(moddleContext) {
  const executable = moddleContext.rootHandler.element.rootElements.find((e) => e.$type === 'bpmn:Process' && e.isExecutable);
  return executable && executable.id;
};

pub.getOutboundSequenceFlows = function(moddleContext, activityId) {
  return moddleContext.references.filter((r) => r.property === 'bpmn:sourceRef' && r.id === activityId);
};

pub.hasInboundSequenceFlows = function(moddleContext, activityId) {
  return moddleContext.references.some((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
};

pub.getInboundSequenceFlows = function(moddleContext, activityId) {
  return moddleContext.references.filter((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
};

pub.getSequenceFlowTargetId = function(moddleContext, sequenceFlowId) {
  const target = moddleContext.references.find((r) => r.property === 'bpmn:targetRef' && r.element.id === sequenceFlowId);
  return target && target.id;
};

pub.isDefaultSequenceFlow = function(moddleContext, sequenceFlowId) {
  return moddleContext.references.some((r) => r.property === 'bpmn:default' && r.id === sequenceFlowId);
};

pub.getTargetProcess = function(moddleContext, targetId) {
  const elements = moddleContext.rootHandler.element.rootElements;
  return elements.find((e) => e.$type === 'bpmn:Process' && e.flowElements.some((f) => f.id === targetId));
};

pub.getActivityIO = function(moddleContext, activityId) {
  const activity = moddleContext.elementsById[activityId];
  if (!activity.extensionElements) return;
  let element = activity.extensionElements.values.find((v) => v.$type.toLowerCase() === 'camunda:inputoutput');
  if (element && element.$type === 'camunda:inputOutput') {
    element = normalizeInputOutput(element);
  }

  return element;
};

pub.getAllOutboundSequenceFlows = function(moddleContext, scopeActivityId) {
  const scope = moddleContext.elementsById[scopeActivityId];
  const outbound = moddleContext.references.filter((r) => {
    if (r.property !== 'bpmn:sourceRef') return false;
    switch (r.element.$type) {
      case 'bpmn:MessageFlow':
      case 'bpmn:SequenceFlow':
        break;
      default:
        return false;
    }

    const sourceId = r.id;
    return scope.flowElements.some((e) => e.id === sourceId);
  });

  return outbound;
};

pub.getChildOutputNames = function(moddleContext, taskId) {
  const contextElement = moddleContext.elementsById[taskId];
  if (!contextElement.dataOutputAssociations) return [];

  return contextElement.dataOutputAssociations.map((association) => {
    return pub.getDataObjectFromAssociation(moddleContext, association.id);
  });
};

pub.getDataObjectFromAssociation = function(moddleContext, associationId) {
  const association = moddleContext.references.find((r) => r.element.$type === 'bpmn:DataOutputAssociation' && r.element.id === associationId && r.property === 'bpmn:targetRef');
  if (!association) return null;

  const potentialRef = moddleContext.elementsById[association.id];
  if (potentialRef.$type === 'bpmn:DataObject') return potentialRef;

  return pub.getDataObjectFromRef(moddleContext, potentialRef.id);
};

pub.getDataObjectFromRef = function(moddleContext, refId) {
  const ref = moddleContext.references.find((r) => r.element.$type === 'bpmn:DataObjectReference' && r.element.id === refId && r.property === 'bpmn:dataObjectRef');
  if (!ref) return null;

  return moddleContext.elementsById[ref.id];
};

pub.isTerminationElement = function(element) {
  if (!element) return false;
  if (!element.eventDefinitions) return false;
  return element.eventDefinitions.some((e) => e.$type === 'bpmn:TerminateEventDefinition');
};

pub.getActivities = function(moddleContext, scopeActivityId) {
  const elements = [];
  const scope = moddleContext.elementsById[scopeActivityId];

  if (!scope.flowElements) return elements;

  Object.keys(moddleContext.elementsById).forEach((key) => {
    if (!scope.flowElements.some((e) => e.id === key)) return;

    const element = moddleContext.elementsById[key];
    switch (element.$type) {
      case 'bpmn:SequenceFlow':
      case 'bpmn:Definitions':
        break;
      default:
        elements.push(element);
    }
  });

  return elements;
};

pub.getBoundaryEvents = function(moddleContext, scopeId) {
  return moddleContext.references.filter((r) => r.property === 'bpmn:attachedToRef' && r.id === scopeId);
};

pub.getAttachedToActivity = function(moddleContext, eventId) {
  return moddleContext.references.find((r) => r.property === 'bpmn:attachedToRef' && r.element.id === eventId);
};

pub.hasAttachedErrorEvent = function(moddleContext, activityId) {
  const boundaryEvents = pub.getBoundaryEvents(moddleContext, activityId);
  return boundaryEvents.some((e) => e.element.eventDefinitions.some((d) => d.$type === 'bpmn:ErrorEventDefinition'));
};

pub.getElementService = function(element) {
  if (!element) return;
  if (!element.extensionElements) return;

  const connector = element.extensionElements.values.find((e) => e.$type === 'camunda:Connector');
  if (connector) {
    return {
      connector: connector
    };
  }

  const properties = element.extensionElements.values.find((e) => e.$type === 'camunda:properties');
  if (!properties) return;
  const property = properties.$children.find((c) => c.name === 'service');
  if (!property) return;

  return {
    name: property.value
  };
};

pub.cloneContext = (context) => {
  const clonedContext = {
    rootHandler: {
      element: JSON.parse(JSON.stringify(context.rootHandler.element))
    },
    elementsById: JSON.parse(JSON.stringify(context.elementsById)),
    references: JSON.parse(JSON.stringify(context.references))
  };
  return clonedContext;
};

function normalizeInputOutput(element) {
  const inputOutput = {
    $type: element.$type,
    inputParameters: [],
    outputParameters: []
  };

  if (!element.$children) return inputOutput;

  element.$children.reduce((result, child) => {
    const parm = {
      $type: child.$type,
      name: child.name
    };

    if (child.$children && child.$children.length) {
      const definition = child.$children[0];
      parm.definition = Object.assign({}, definition);
      if (definition.$body) {
        parm.definition.value = definition.$body;
        delete parm.definition.$body;
      }
    } else if (child.$body) {
      parm.value = child.$body;
    }

    if (parm.$type === 'camunda:inputParameter') {
      result.inputParameters.push(parm);
    } else if (parm.$type === 'camunda:outputParameter') {
      result.outputParameters.push(parm);
    }

    return result;
  }, inputOutput);

  return inputOutput;
}

module.exports = pub;
