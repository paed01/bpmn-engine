'use strict';

const Camunda = require('./extensions/camunda');
const Bpmn = require('./extensions/bpmn');

const extensions = [
  Bpmn,
  Camunda,
];

module.exports = function ExtensionsMapper(context) {
  const cache = {};

  return {
    get,
    getServices
  };

  function get(activityElement) {
    const {id} = activityElement;
    const cached = id && cache[id];
    if (cached) return cached;

    const ios = [];
    const forms = [];
    const services = [];
    const properties = [];

    extensions.forEach(addExtension);

    const result = {
      forms,
      ios,
      services
    };

    if (id) {
      cache[id] = result;
    }

    return {
      forms,
      ios,
      properties,
      services,
    };

    function addExtension(Extension) {
      const extension = Extension(activityElement, context);
      if (!extension) return;

      const {form, io, properties: extProperties, service} = extension;
      if (io) ios.push(io);
      if (form) forms.push(form);
      if (service) services.push(service);
      if (extProperties) properties.push(extProperties);
    }
  }

  function getServices(activityElement) {
    const {services} = get(activityElement);
    return services;
  }
};
