'use strict';

const Debug = require('debug');
const Flow = require('./Flow');

module.exports = function MessageFlow(activity, parentContext) {
  const flowApi = Flow(activity, parentContext);
  const id = flowApi.id;
  const type = flowApi.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const takeFlow = flowApi.take;

  flowApi.outboundMessage = true;
  flowApi.take = (message) => {
    takeFlow(message);
    debug(`<${id}> send message:`, message);
    flowApi.emit('message', formatMessage(message));
    return true;
  };

  return flowApi;

  function formatMessage(message) {
    return {
      via: flowApi,
      message
    };
  }
};

