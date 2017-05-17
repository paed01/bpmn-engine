'use strict';

module.exports = function contextHelper(moddleContext) {

  return {
    cloneContext: cloneContext,
    getActivities: getActivities,
    getActivityErrorEventDefinition: getActivityErrorEventDefinition,
    getActivityFormData: getActivityFormData,
    getActivityIO: getActivityIO,
    getActivityProperties: getActivityProperties,
    getAllOutboundSequenceFlows: getAllOutboundSequenceFlows,
    getAttachedToActivity: getAttachedToActivity,
    getBoundaryEvents: getBoundaryEvents,
    getChildOutputNames: getChildOutputNames,
    getDataObjectFromAssociation: getDataObjectFromAssociation,
    getDataObjectFromRef: getDataObjectFromRef,
    getDefinitionId: getDefinitionId,
    getElementService: getElementService,
    getExecutableProcessId: getExecutableProcessId,
    getInboundMessageFlows: getInboundMessageFlows,
    getInboundSequenceFlows: getInboundSequenceFlows,
    getOutboundSequenceFlows: getOutboundSequenceFlows,
    getProcesses: getProcesses,
    getSequenceFlowTargetId: getSequenceFlowTargetId,
    getTargetProcess: getTargetProcess,
    hasAttachedErrorEvent: hasAttachedErrorEvent,
    hasInboundSequenceFlows: hasInboundSequenceFlows,
    isDefaultSequenceFlow: isDefaultSequenceFlow,
    isTerminationElement: isTerminationElement
  };

  function getDefinitionId() {
    return moddleContext.rootHandler.element.id;
  }

  function getProcesses() {
    return moddleContext.rootHandler.element.rootElements.filter((e) => e.$type === 'bpmn:Process');
  }

  function getExecutableProcessId() {
    const executable = moddleContext.rootHandler.element.rootElements.find((e) => e.$type === 'bpmn:Process' && e.isExecutable);
    return executable && executable.id;
  }

  function getOutboundSequenceFlows(activityId) {
    return moddleContext.references.filter((r) => r.property === 'bpmn:sourceRef' && r.id === activityId);
  }

  function hasInboundSequenceFlows(activityId) {
    return moddleContext.references.some((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
  }

  function getInboundSequenceFlows(activityId) {
    return moddleContext.references.filter((r) => r.property === 'bpmn:targetRef' && r.id === activityId);
  }

  function getSequenceFlowTargetId(sequenceFlowId) {
    const target = moddleContext.references.find((r) => r.property === 'bpmn:targetRef' && r.element.id === sequenceFlowId);
    return target && target.id;
  }

  function isDefaultSequenceFlow(sequenceFlowId) {
    return moddleContext.references.some((r) => r.property === 'bpmn:default' && r.id === sequenceFlowId);
  }

  function getTargetProcess(targetId) {
    const elements = moddleContext.rootHandler.element.rootElements;
    return elements.find((e) => e.$type === 'bpmn:Process' && e.flowElements.some((f) => f.id === targetId));
  }

  function getActivityInputOutput(activity) {
    if (!activity.extensionElements || !activity.extensionElements.values) return;
    const element = activity.extensionElements.values.find((v) => v.$type === 'camunda:InputOutput');
    return element;
  }

  function getActivityIO(activityId) {
    const activity = moddleContext.elementsById[activityId];
    return getActivityInputOutput(activity);
  }

  function getActivityProperties(activityId) {
    const activity = moddleContext.elementsById[activityId];
    if (!activity) return;
    if (!activity.extensionElements) return;

    const properties = activity.extensionElements.values.find((e) => e.$type.toLowerCase() === 'camunda:properties');
    if (!properties || !properties.values) return;

    return properties;
  }

  function getActivityFormData(activity) {
    let element;
    if (activity.extensionElements && activity.extensionElements.values) {
      element = activity.extensionElements.values.find((v) => v.$type === 'camunda:FormData');
    }
    if (!element && activity.formKey) {
      return {
        formKey: activity.formKey
      };
    }

    return element;
  }

  function getAllOutboundSequenceFlows(scopeActivityId) {
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
  }

  function getInboundMessageFlows(scopeActivityId) {
    const scope = moddleContext.elementsById[scopeActivityId];

    const outbound = moddleContext.references.filter((r) => {
      if (r.property !== 'bpmn:targetRef') return false;
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
  }

  function getChildOutputNames(taskId) {
    const contextElement = moddleContext.elementsById[taskId];
    if (!contextElement.dataOutputAssociations) return [];

    return contextElement.dataOutputAssociations.map((association) => {
      return getDataObjectFromAssociation(association.id);
    });
  }

  function getDataObjectFromAssociation(associationId) {
    const association = moddleContext.references.find((r) => r.element.$type === 'bpmn:DataOutputAssociation' && r.element.id === associationId && r.property === 'bpmn:targetRef');
    if (!association) return null;

    const potentialRef = moddleContext.elementsById[association.id];
    if (potentialRef.$type === 'bpmn:DataObject') return potentialRef;

    return getDataObjectFromRef(potentialRef.id);
  }

  function getDataObjectFromRef(refId) {
    const ref = moddleContext.references.find((r) => r.element.$type === 'bpmn:DataObjectReference' && r.element.id === refId && r.property === 'bpmn:dataObjectRef');
    if (!ref) return null;

    return moddleContext.elementsById[ref.id];
  }

  function isTerminationElement(element) {
    if (!element) return false;
    if (!element.eventDefinitions) return false;
    return element.eventDefinitions.some((e) => e.$type === 'bpmn:TerminateEventDefinition');
  }

  function getActivities(scopeActivityId) {
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
  }

  function getBoundaryEvents(scopeId) {
    return moddleContext.references.filter((r) => r.property === 'bpmn:attachedToRef' && r.id === scopeId);
  }

  function getAttachedToActivity(eventId) {
    return moddleContext.references.find((r) => r.property === 'bpmn:attachedToRef' && r.element.id === eventId);
  }

  function hasAttachedErrorEvent(activityId) {
    const boundaryEvents = getBoundaryEvents(activityId);
    return boundaryEvents.some((e) => e.element.eventDefinitions.some((d) => d.$type === 'bpmn:ErrorEventDefinition'));
  }

  function getElementService(element) {
    if (!element) return;
    if (!element.extensionElements) return;

    const connector = element.extensionElements.values.find((e) => e.$type === 'camunda:Connector');
    if (connector) {
      return {
        connector: connector
      };
    }

    const properties = element.extensionElements.values.find((e) => e.$type.toLowerCase() === 'camunda:properties');
    if (!properties) return;
    const property = (properties.values || properties.$children).find((c) => c.name === 'service');
    if (!property) return;

    return {
      name: property.value
    };
  }

  function cloneContext(context) {
    const clonedContext = {
      rootHandler: {
        element: JSON.parse(JSON.stringify(context.rootHandler.element))
      },
      elementsById: JSON.parse(JSON.stringify(context.elementsById)),
      references: JSON.parse(JSON.stringify(context.references)),
      warnings: context.warnings.slice()
    };
    return clonedContext;
  }

  function getActivityErrorEventDefinition(activity) {
    if (!activity || !activity.eventDefinitions) return;
    return activity.eventDefinitions.find((ed) => ed.$type === 'bpmn:ErrorEventDefinition');
  }
};
