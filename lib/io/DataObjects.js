'use strict';

const debug = require('debug')('bpmn-engine:io:dataobjects');

module.exports = function DataObjects(dataObjects, {dataInputAssociations, dataObjectRefs, dataOutputAssociations}, environment) {
  const inputAssociations = Associations(dataInputAssociations);
  const outputAssociations = Associations(dataOutputAssociations);

  return {
    getActivityInputValue,
    getDataObject
  };

  function getActivityInputValue(refId) {
    const {element} = inputAssociations[refId];
    if (!element) return;
    return element.getValue();
  }

  function getDataObject(refId) {
    const association = outputAssociations[refId];
    if (!association) return;
    return association.element;
  }

  function Associations(dataAssociations) {
    return dataAssociations.reduce((result, ia) => {
      const element = result[ia.element.id] = result[ia.element.id] || {
        id: ia.element.id,
        type: ia.element.$type
      };
      const ref = result[ia.id] = result[ia.id] || {
        element,
        type: ia.property,
        refId: ia.id
      };
      if (ia.property === 'bpmn:sourceRef') {
        element.source = ia.id;
        ref.targetRef = ia.element.id;
      }
      if (ia.property === 'bpmn:targetRef') {
        const targetId = element.targetRef = ia.id;
        ref.source = ia.element.id;
        const target = element.target = dataObjectRefs.find((dataObject) => dataObject.element.id === targetId);

        element.getValue = function get() {
          if (!target) return;
          return environment.get(target.id);
        };

        element.save = function save(value) {
          debug(`save <${target.id}> to environment`);

          return environment.setOutputValue(target.id, value);
        };
      }

      return result;
    }, {});
  }
};

