'use strict';

const IoSpecification = require('./IoSpecification');
const ServiceImplementation = require('./ServiceImplementation');

module.exports = function Bpmn(activityElement, parentContext) {
  const {$type, ioSpecification} = activityElement;
  return init();

  function init() {
    const io = loadIo();
    const service = loadService();
    return {
      io,
      service
    };
  }

  function loadService() {
    if ($type === 'bpmn:ServiceTask') {
      if (activityElement.implementation) {
        return ServiceImplementation(activityElement, parentContext);
      }
    }
  }

  function loadIo() {
    if (ioSpecification) {
      return IoSpecification(ioSpecification, parentContext);
    }
  }
};
