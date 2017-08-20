'use strict';

const Debug = require('debug');
const {EventEmitter} = require('events');

module.exports = function Flow(activity, parentContext) {
  const id = activity.element.id;
  const type = activity.element.$type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const sourceId = activity.id;
  const targetId = parentContext.getSequenceFlowTargetId(id);

  const flowApi = Object.assign(new EventEmitter(), {
    id,
    type,
    sourceId,
    targetId,
    discard,
    take
  });

  debug(`<${id}> init, <${sourceId}> -> <${targetId}>`);

  return flowApi;

  function take() {
    flowApi.taken = true;
    flowApi.discarded = false;
    flowApi.looped = undefined;
    debug(`<${id}> taken, target <${targetId}>`);
    asyncEmitEvent('taken');
    return true;
  }

  function discard(rootFlow) {
    if (rootFlow && rootFlow.sourceId === targetId) {
      debug(`<${id}> detected loop <${rootFlow.sourceId}>. Stop.`);
      flowApi.looped = true;
      flowApi.emit('looped', flowApi, rootFlow);
      return;
    }

    debug(`<${id}> discarded, target <${targetId}>`);
    flowApi.looped = undefined;
    flowApi.discarded = true;
    asyncEmitEvent('discarded', rootFlow || flowApi);
  }

  function asyncEmitEvent(eventName, rootFlow) {
    setImmediate(() => {
      flowApi.emit(eventName, flowApi, rootFlow);
    });
  }
};
