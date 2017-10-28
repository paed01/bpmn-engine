'use strict';

const ElementPropertyIo = require('../ElementPropertyIo');

module.exports = function BoundaryEvent(extensions, activityElement, parentContext) {
  const {eventDefinitions} = activityElement;
  const {io} = extensions;

  extensions.io = loadIo();

  return extensions;

  function loadIo() {
    if (io) return io;
    if (!eventDefinitions) return;

    const elementPropertyIo = ElementPropertyIo(activityElement, parentContext);

    eventDefinitions.forEach((ed) => {
      if (ed.$type === 'bpmn:ErrorEventDefinition') {
        if (ed.errorCodeVariable) elementPropertyIo.addOutputParameter('errorCode', ed.errorCodeVariable);
        if (ed.errorMessageVariable) elementPropertyIo.addOutputParameter('errorMessage', ed.errorMessageVariable);
      }
    });

    return elementPropertyIo.getInfo().output.length ? elementPropertyIo : undefined;
  }
};
