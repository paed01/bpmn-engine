'use strict';

module.exports = function EvaluateOutbound(activity, executionContext, evaluateOutbound, callback) {
  const id = activity.id;
  const type = activity.type;
  const outbound = activity.outbound;

  let discardedOutbound = [];
  let executionApi, listenOutbound;
  let pendingOutbound = executionContext.getPendingOutbound();

  let pendingFork = activity.outbound.length > 1;

  const runContext = {
    id,
    type,
    applyState,
    complete,
    executionContext,
    getActivityApi,
    getState,
    start,
    stop
  };

  return runContext;

  function start() {
    activate();
    executionApi = executionContext.postpone(callback);
    return takeAllOutbound();
  }

  function applyState(state) {
    executionContext.applyState(state);

    if (state.discardedOutbound) {
      discardedOutbound = state.discardedOutbound.map((flowId) => outbound.find((flow) => flowId === flow.id));
    }
    if (state.pendingFork) {
      pendingFork = true;
      pendingOutbound = executionContext.getPendingOutbound();
    }
  }

  function getState() {
    const state = executionContext.getState();

    if (pendingFork) {
      state.pendingFork = pendingFork;
      state.pendingOutbound = pendingOutbound.map((flow) => flow.id);
    }
    if (discardedOutbound.length) {
      state.discardedOutbound = discardedOutbound.map((flow) => flow.id);
    }

    return state;
  }

  function getActivityState() {
    return {
      pendingFork,
      pendingOutbound,
      getState,
      stop
    };
  }

  function activate() {
    listenOutbound = pendingOutbound.slice();
    listenOutbound.forEach((flow) => {
      flow.on('taken', onOutbound);
      flow.on('discarded', onOutbound);
    });
  }

  function deactivate() {
    if (listenOutbound) {
      listenOutbound.forEach((flow) => {
        flow.removeListener('taken', onOutbound);
        flow.removeListener('discarded', onOutbound);
      });
    }
  }

  function complete() {
    deactivate();
    if (discardedOutbound.length === outbound.length) return executionApi.error(new Error(`No conditional flow was taken from <${id}>`));
    return setImmediate(executionApi.complete, null, false);
  }

  function onOutbound(flow, baseRootFlow) {
    const pendingIndex = pendingOutbound.indexOf(flow);
    if (pendingIndex > -1) {
      pendingOutbound.splice(pendingIndex, 1);
    }

    if (flow.discarded) {
      activity._debug(`<${id}> outbound <${flow.id}> discarded - pending ${pendingOutbound.length}`);
      discardedOutbound.push(flow);
    } else {
      activity._debug(`<${id}> outbound <${flow.id}> taken - pending ${pendingOutbound.length}`);
    }

    if (pendingOutbound.length === 0) {
      return complete(flow, baseRootFlow);
    }
  }

  function getActivityApi() {
    return executionContext.getActivityApi(getActivityState());
  }

  function stop() {
    deactivate();
    return executionContext.stop();
  }

  function takeAllOutbound() {
    if (!pendingOutbound.length) {
      return complete();
    }

    activity.emit('start', getActivityApi());

    evaluateOutbound(pendingOutbound, executionContext.getContextOutput());
  }
};
