'use strict';

const Activity = require('./activities');
const Form = require('./Form');
const FormKey = require('./FormKey');
const InputOutput = require('./InputOutput');
const Properties = require('./Properties');
const ResultVariableIo = require('./ResultVariableIo');

module.exports = function Camunda(activityElement, parentContext) {
  const {extensionElements, formKey} = activityElement;
  const hasExtValues = extensionElements && extensionElements.values;

  const properties = loadProperties();
  const form = loadForm();
  const io = loadIo(form);

  return Activity({
    io,
    properties,
    form,
  }, activityElement, parentContext);

  function loadIo() {
    if (hasExtValues) {
      const source = extensionElements.values.find((elm) => elm.$type === 'camunda:InputOutput');
      if (source) return InputOutput(source, parentContext, form);
    }
    if (activityElement.resultVariable) {
      return ResultVariableIo(activityElement, parentContext, form);
    }
  }

  function loadForm() {
    if (hasExtValues) {
      const source = extensionElements.values.find((elm) => elm.$type === 'camunda:FormData');
      if (source) return Form(source, parentContext);
    }

    if (formKey) return FormKey(activityElement, parentContext);
  }

  function loadProperties() {
    if (!hasExtValues) return;

    const source = extensionElements.values.find((elm) => elm.$type === 'camunda:Properties');
    if (source) return Properties(source, parentContext);
  }
};
