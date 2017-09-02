'use strict';

const debug = require('debug')('bpmn-engine:io:dataobjects');

module.exports = function DataObjects({dataInputAssociations, dataObjectRefs, dataOutputAssociations}, environment) {
  const inputAssociations = Associations(dataInputAssociations);
  const outputAssociations = Associations(dataOutputAssociations);

  return {
    getActivityInputValue,
    saveActivityOutputValue
  };

  function getActivityInputValue(refId) {
    const association = inputAssociations[refId];
    if (!association) return;
    return association.getValue();
  }

  function saveActivityOutputValue(refId, value) {
    const association = outputAssociations[refId];
    if (!association) return;
    return association.save(value);
  }

  function Associations(dataAssociations) {
    return dataAssociations.reduce((result, dataAssociation) => {
      const {id: referenceId, property} = dataAssociation;

      if (property === 'bpmn:sourceRef') {
        result[referenceId] = Association(dataAssociation);
      }

      return result;
    }, {});

    function Association({id, element}) {
      const associationId = element.id;
      const targetRef = dataAssociations.find((da) => da.property === 'bpmn:targetRef' && da.element.id === associationId);
      let target;
      if (targetRef) {
        target = dataObjectRefs.find((dataObject) => dataObject.element.id === targetRef.id);
      }

      return {
        id,
        getValue,
        save
      };

      function getValue() {
        if (!target) return;
        debug(`get <${id}> from <${associationId}> via <${target.element.id}> -> <${target.id}> from environment`);
        return environment.get(target.id);
      }

      function save(value) {
        if (!target) return;
        debug(`save <${id}> via <${associationId}> -> <${target.element.id}> -> <${target.id}> to environment`);
        return environment.setOutputValue(target.id, value);
      }
    }
  }
};

