'use strict';

module.exports = function contextHelper(moddleContext) {
  const {elementsById, references, rootHandler} = moddleContext;
  const sourceRefs = references.filter((r) => r.property === 'bpmn:sourceRef');
  const targetRefs = references.filter((r) => r.property === 'bpmn:targetRef');

  const dataObjectRefs = references.filter((r) => r.property === 'bpmn:dataObjectRef');
  const dataObjects = dataObjectRefs.map((ref) => elementsById[ref.id]);
  const dataInputRefs = references.filter(({property}) => property === 'bpmn:dataInputRefs');
  const dataOutputRefs = references.filter(({property}) => property === 'bpmn:dataOutputRefs');

  const definitionId = rootHandler.element.id || 'anonymous';

  return {
    clone,
    getActivityById,
    getActivities,
    getActivityErrorEventDefinition,
    getActivityFormData,
    getActivityInputOutput,
    getActivityIO,
    getActivityIOReferences,
    getActivityProperties,
    getAllOutboundSequenceFlows,
    getAttachedToActivity,
    getBoundaryEvents,
    getDataObjectFromRef,
    getDataObjectReferences,
    getDataObjects,
    getDefinitionId,
    getElementService,
    getErrorByReference,
    getExecutableProcessId,
    getInboundMessageFlows,
    getInboundSequenceFlows,
    getOutboundSequenceFlows,
    getProcesses,
    getSequenceFlowTargetId,
    getTargetProcess,
    hasAttachedErrorEvent,
    hasInboundSequenceFlows,
    isDefaultSequenceFlow,
    isTerminationElement
  };

  function getDefinitionId() {
    return definitionId;
  }

  function getProcesses() {
    return rootHandler.element.rootElements.filter((e) => e.$type === 'bpmn:Process');
  }

  function getActivityById(activityId) {
    return elementsById[activityId];
  }

  function getExecutableProcessId() {
    const executable = rootHandler.element.rootElements.find((e) => e.$type === 'bpmn:Process' && e.isExecutable);
    return executable && executable.id;
  }

  function getOutboundSequenceFlows(activityId) {
    return sourceRefs.filter((r) => r.id === activityId);
  }

  function hasInboundSequenceFlows(activityId) {
    return targetRefs.some((r) => r.id === activityId);
  }

  function getInboundSequenceFlows(activityId) {
    return targetRefs.filter((r) => r.id === activityId);
  }

  function getSequenceFlowTargetId(sequenceFlowId) {
    const target = targetRefs.find((r) => r.element.id === sequenceFlowId);
    return target && target.id;
  }

  function isDefaultSequenceFlow(sequenceFlowId) {
    return references.some((r) => r.property === 'bpmn:default' && r.id === sequenceFlowId);
  }

  function getTargetProcess(targetId) {
    const elements = rootHandler.element.rootElements;
    return elements.find((e) => e.$type === 'bpmn:Process' && e.flowElements.some((f) => f.id === targetId));
  }

  function getDataObjectFromRef(refId) {
    const ref = references.find((r) => r.element.$type === 'bpmn:DataObjectReference' && r.element.id === refId && r.property === 'bpmn:dataObjectRef');
    if (!ref) return null;

    return elementsById[ref.id];
  }

  function getActivityIO(activityElement) {
    return getActivityInputOutput(activityElement);
  }

  function getActivityInputOutput(activity) {
    if (activity.extensionElements && activity.extensionElements.values) {
      const element = activity.extensionElements.values.find((v) => v.$type === 'camunda:InputOutput');
      if (element) return element;
    }
    return activity.ioSpecification;
  }

  function getActivityIOReferences(ioSpecification) {
    const inputSet = ioSpecification.inputSets && ioSpecification.inputSets.reduce((result, {id}) => {
      result = result.concat(dataInputRefs.filter(({element}) => element.id === id));
      return result;
    }, []);

    const outputSet = ioSpecification.outputSets && ioSpecification.outputSets.reduce((result, {id}) => {
      result = result.concat(dataOutputRefs.filter(({element}) => element.id === id));
      return result;
    }, []);

    return {
      inputSet,
      outputSet
    };
  }

  function getDataObjects() {
    return dataObjects;
  }

  function getDataObjectReferences() {
    const dataInputAssociations = references.filter(({element}) => element.$type === 'bpmn:DataInputAssociation');
    const dataOutputAssociations = references.filter(({element}) => element.$type === 'bpmn:DataOutputAssociation');
    return {
      dataInputAssociations,
      dataObjectRefs,
      dataOutputAssociations
    };
  }

  function getActivityProperties(activityId) {
    const activity = elementsById[activityId];
    if (!activity) return;
    if (!activity.extensionElements) return;

    const properties = activity.extensionElements.values.find((e) => e.$type.toLowerCase() === 'camunda:properties');
    if (!properties || !properties.values) return;

    return properties;
  }

  function getActivityFormData(activity) {
    if (activity.extensionElements && activity.extensionElements.values) {
      return activity.extensionElements.values.find((v) => v.$type === 'camunda:FormData');
    }
  }

  function getAllOutboundSequenceFlows(scopeActivityId) {
    const scope = elementsById[scopeActivityId];
    const outbound = sourceRefs.filter((r) => {
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
    return targetRefs.filter((r) => r.element.$type === 'bpmn:MessageFlow' && r.id === scopeActivityId);
  }

  function isTerminationElement(element) {
    if (!element) return false;
    if (!element.eventDefinitions) return false;
    return element.eventDefinitions.some((e) => e.$type === 'bpmn:TerminateEventDefinition');
  }

  function getActivities(scopeActivityId) {
    const elements = [];
    const scope = elementsById[scopeActivityId];

    if (!scope.flowElements) return elements;

    Object.keys(moddleContext.elementsById).forEach((key) => {
      if (!scope.flowElements.some((e) => e.id === key)) return;

      const element = elementsById[key];
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
    return references.filter((r) => r.property === 'bpmn:attachedToRef' && r.id === scopeId);
  }

  function getAttachedToActivity(eventId) {
    return references.find((r) => r.property === 'bpmn:attachedToRef' && r.element.id === eventId);
  }

  function getErrorByReference(activity) {
    return moddleContext.references.find(({property, element}) => property === 'bpmn:errorRef' && element === activity);
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

  function clone() {
    const clonedContext = {
      rootHandler: {
        element: JSON.parse(JSON.stringify(moddleContext.rootHandler.element))
      },
      elementsById: JSON.parse(JSON.stringify(moddleContext.elementsById)),
      references: JSON.parse(JSON.stringify(moddleContext.references)),
      warnings: moddleContext.warnings.slice()
    };
    return clonedContext;
  }

  function getActivityErrorEventDefinition(activity) {
    if (!activity || !activity.eventDefinitions) return;
    return activity.eventDefinitions.find((ed) => ed.$type === 'bpmn:ErrorEventDefinition');
  }
};
