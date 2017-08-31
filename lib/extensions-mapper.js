'use strict';

const ActivityIO = require('./io/ActivityIO');
const ElementPropertyIo = require('./io/ElementPropertyIo');
const Form = require('./io/Form');
const InputOutput = require('./io/InputOutput');
const IoSpecification = require('./io/IoSpecification');

const ioTypes = {}, formTypes = {};

ioTypes['bpmn:InputOutputSpecification'] = IoSpecification;
ioTypes['bpmn:ErrorEventDefinition'] = ElementPropertyIo;
ioTypes['camunda:InputOutput'] = InputOutput;

formTypes['camunda:FormData'] = Form;

module.exports = function ExtensionsMapper(context) {
  return {
    get
  };

  function ioFromType(type) {
    return ioTypes[type];
  }

  function get(activityElement) {
    const {extensionElements, ioSpecification} = activityElement;

    let io, form;
    if (extensionElements && extensionElements.values) {
      for (let i = 0; i < extensionElements.values.length; i++) {
        const value = extensionElements.values[i];
        const extensionType = value.$type;
        const ActivityIOType = ioTypes[extensionType];
        if (ActivityIOType) {
          io = ActivityIOType(value, context);
          continue;
        }

        const FormType = formTypes[extensionType];
        if (FormType) {
          form = FormType(value, context);
        }
      }
    }

    if (!io) {
      if (ioSpecification) {
        io = ioFromType(ioSpecification.$type)(ioSpecification, context);
      } else if (ioTypes[activityElement.$type]) {
        io = ioTypes[activityElement.$type](activityElement, context);
      } else {
        io = ActivityIO(activityElement, context);
      }
    }

    return {
      form,
      io
    };
  }
};
