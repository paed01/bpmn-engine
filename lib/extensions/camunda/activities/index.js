'use strict';

const BoundaryEvent = require('./BoundaryEvent');
const FormIo = require('../FormIo');
const ServiceTask = require('./ServiceTask');

module.exports = function Activity(extensions, activityElement, parentContext) {
  const {$type} = activityElement;
  const {form, io, properties} = extensions;

  if ($type === 'bpmn:ServiceTask') return ServiceTask({io, properties}, activityElement, parentContext);
  else if ($type === 'bpmn:BoundaryEvent') return BoundaryEvent({io, properties}, activityElement, parentContext);
  return Base();

  function Base() {
    let loadedIo = io;
    if (!loadedIo && form) {
      loadedIo = FormIo(form, parentContext);
    }

    return {
      io: loadedIo,
      properties
    };
  }
};
