'use strict';

module.exports = function contextHelper(moddleContext) {
  const {elementsById, references, rootHandler, warnings} = moddleContext;
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
    getActivityIOReferences,
    getAllOutboundSequenceFlows,
    getAttachedToActivity,
    getDataObjectReferences,
    getDataObjects,
    getDefinitionId,
    getErrorByReference,
    getExecutableProcessId,
    getInboundSequenceFlows,
    getOutboundSequenceFlows,
    getProcesses,
    getSequenceFlowTargetId,
    getTargetProcess,
    hasInboundSequenceFlows,
    isDefaultSequenceFlow
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

  function getActivities(scopeActivityId) {
    const elements = [];
    const scope = elementsById[scopeActivityId];

    if (!scope.flowElements) return elements;

    Object.keys(elementsById).forEach((key) => {
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

  function getAttachedToActivity(eventId) {
    return references.find((r) => r.property === 'bpmn:attachedToRef' && r.element.id === eventId);
  }

  function getErrorByReference(activity) {
    return references.find(({property, element}) => property === 'bpmn:errorRef' && element === activity);
  }

  function clone() {
    const clonedContext = {
      rootHandler: {
        element: JSON.parse(JSON.stringify(rootHandler.element))
      },
      elementsById: JSON.parse(JSON.stringify(elementsById)),
      references: JSON.parse(JSON.stringify(references)),
      warnings: warnings.slice()
    };
    return clonedContext;
  }
};
