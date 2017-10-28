'use strict';

const Debug = require('debug');

module.exports = function Service(activityElement, parentContext) {
  const {id, $type} = activityElement;
  const type = `service:${$type}`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const {services} = parentContext.getActivityExtensions(activityElement);

  return {
    id,
    type,
    services,
    activate,
    resume: resumeService
  };

  function resumeService(parentApi, state) {
    const serviceApi = activate(parentApi);
    serviceApi.resume(state.services);
    return serviceApi;
  }

  function activate(parentApi, inputContext) {
    const {id: activityId} = parentApi;
    const {isLoopContext, index} = inputContext;
    if (!isLoopContext && parentApi.loopCharacteristics) {
      inputContext.isLooped = true;
    }

    let activatedServices;

    debug(`<${activityId}> service${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    return {
      id,
      type,
      isLoopContext,
      execute,
      getService,
    };

    function execute(...args) {
      return getService().execute(...args);
    }

    function getService() {
      return getServices()[0];
    }

    function getServices() {
      if (activatedServices) return activatedServices;
      if (services && services.length) {
        activatedServices = services.map((service) => service.activate(parentApi, inputContext));
      } else {
        activatedServices = [getDummyService()];
      }
      return activatedServices;
    }
  }

  function getDummyService() {
    debug(`<${id}> returning dummy service`);

    return {
      type: 'dummyservice',
      execute
    };

    function execute(...args) {
      debug(`<${id}> executing dummy service`);
      const len = args.length;
      if (typeof args[len - 1] === 'function') args[len - 1]();
    }
  }
};
