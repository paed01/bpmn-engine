'use strict';

const Connector = require('../Connector');
const ResultVariableIo = require('../ResultVariableIo');
const ServiceExpression = require('../ServiceExpression');
const ServiceProperty = require('../ServiceProperty');

module.exports = function ServiceTask(extensions, activityElement, parentContext) {
  const {io, properties} = extensions;
  const {extensionElements, resultVariable} = activityElement;
  const hasExtValues = extensionElements && extensionElements.values;

  if (!io && resultVariable) {
    extensions.io = ResultVariableIo(activityElement, parentContext);
  }
  extensions.service = loadService();

  return extensions;

  function loadService() {
    if (hasExtValues) {
      const source = extensionElements.values.find((elm) => elm.$type === 'camunda:Connector');
      if (source) return Connector(source, parentContext);
    }

    if (activityElement.expression) {
      return ServiceExpression(activityElement, parentContext);
    } else if (properties && properties.getProperty('service')) {
      return ServiceProperty(activityElement, parentContext, properties.getProperty('service'));
    }
  }
};
