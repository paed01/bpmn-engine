'use strict';

const Bpmn = require('./extensions/bpmn');

const defaultExtensions = [
  Bpmn
];

module.exports = function ExtensionsMapper(context) {
  const cache = {};
  const {extensions: envExtensions} = context.environment;
  const extensions = defaultExtensions.concat(getExtensions());

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

    extensions.forEach(applyExtension);

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

    function applyExtension(Extension) {
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

  function getExtensions() {
    const result = [];
    if (!envExtensions) return result;
    for (const key in envExtensions) {
      const extension = envExtensions[key].extension;
      if (extension) {
        result.push(extension);
      }
    }
    return result;
  }
};
