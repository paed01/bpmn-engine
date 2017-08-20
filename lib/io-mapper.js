'use strict';

const ActivityIO = require('./io/ActivityIO');
const DataObjects = require('./io/DataObjects');
const ElementPropertyIo = require('./io/ElementPropertyIo');
const Form = require('./io/Form');
const InputOutput = require('./io/InputOutput');
const IoSpecification = require('./io/IoSpecification');

const ioTypes = {};

ioTypes['bpmn:InputOutputSpecification'] = IoSpecification;
ioTypes['camunda:InputOutput'] = InputOutput;
ioTypes['camunda:FormData'] = Form;
ioTypes['bpmn:ErrorEventDefinition'] = ElementPropertyIo;

module.exports = function IoMapper(contextHelper, environment) {
  const dataObjects = DataObjects(contextHelper.getDataObjects(), contextHelper.getDataObjectReferences(), environment);

  return {
    dataObjects,
    fromElement,
    fromType
  };

  function fromType(type) {
    return ioTypes[type];
  }

  function fromElement(element) {
    return ioTypes[element.$type] || ActivityIO;
  }
};
