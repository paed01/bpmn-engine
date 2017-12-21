'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {ActivityError} = require('../errors');

module.exports = function DecisionGateway(gateway, execute, state) {
  const {id, type, environment, inbound, outbound, flows} = gateway;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = (...args) => gateway.emit(...args);

  let resumed = !!state;

  let activityExecution, immediateLeave, pendingDiscard, stopped;

  let discardedOutbound = getDiscardedOutbound();
  let pendingOutbound = getPendingOutbound();

  state = Object.assign(state || {}, {
    id,
    type
  });

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    deactivate,
    getApi,
    getState,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function run(message, inboundFlow) {
    stopPendingDiscard();
    activityExecution = ActivityExecution(gateway, message, environment, inboundFlow);
    enter(activityExecution);

    if (stopped) return;

    pendingOutbound = getPendingOutbound();

    activateOutbound();
    emit('start', activityApi, activityExecution);

    execute(pendingOutbound, activityExecution, () => {
      debug(`<${id}> all flows evaluated`);
      state.taken = true;
      emit('end', activityApi, activityExecution);
      if (outbound.length === 0) completeCallback();
    });

    return activityApi;
  }

  function resume() {
    if (resumed && state.entered) return run();
    return activityApi;
  }

  function stop() {
    stopped = true;
    deactivate();
  }

  function getState() {
    const result = {id, type};

    if (state.taken) {
      result.taken = true;
    }
    result.entered = state.entered;

    if (pendingOutbound && pendingOutbound.length) {
      result.pendingOutbound = pendingOutbound.map(({id: flowId}) => flowId);
    }
    if (discardedOutbound.length) {
      result.discardedOutbound = discardedOutbound.map(({id: flowId}) => flowId);
    }

    return result;
  }

  function activate() {
    stopped = false;

    flows.activate(state)
      .on('inbound-taken', onInboundTaken)
      .on('inbound-discarded', onInboundDiscarded);
  }

  function deactivate() {
    stopPendingDiscard();

    flows.deactivate()
      .removeListener('inbound-taken', onInboundTaken)
      .removeListener('inbound-discarded', onInboundDiscarded);

    deactivateOutbound();
    if (immediateLeave) clearImmediate(immediateLeave);
    immediateLeave = null;
  }

  function activateOutbound() {
    pendingOutbound.forEach((flow) => {
      flow.prependListener('taken', onOutbound);
      flow.prependListener('discarded', onOutbound);
    });
  }

  function deactivateOutbound() {
    outbound.forEach((flow) => {
      flow.removeListener('taken', onOutbound);
      flow.removeListener('discarded', onOutbound);
    });
  }

  function onInboundTaken(inboundFlow) {
    run(null, inboundFlow);
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    if (state.entered) {
      debug(`<${id}> ignoring discarded inbound from <${inboundFlow.sourceId}>`);
      return;
    }

    if (inbound.length > 1) {
      return startPendingDiscard(inboundFlow, rootFlow);
    }

    activityExecution = ActivityExecution(gateway, null, environment, inboundFlow, rootFlow);
    enter(activityExecution);
    discardAllOutbound(rootFlow);
  }

  function enter(executionContext) {
    if (!resumed && state.entered) return emit('error', new ActivityError(`Already entered <${id}>`, activityApi));

    state.entered = true;
    state.taken = undefined;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function completeCallback(err) {
    state.entered = undefined;

    if (err) {
      return emit('error', err, gateway);
    }
    debug(`<${id}> completed`);
    complete();
  }

  function complete() {
    reset();
    asyncEmitLeave(activityApi, activityExecution);
  }

  function discardAllOutbound(rootFlow) {
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
    state.entered = undefined;
    emit('leave', activityApi, activityExecution);
  }

  function onOutbound(flow) {
    const pendingIndex = pendingOutbound.indexOf(flow);
    if (pendingIndex > -1) {
      pendingOutbound.splice(pendingIndex, 1);
    }

    if (flow.discarded) {
      debug(`<${id}> outbound <${flow.id}> discarded - pending ${pendingOutbound.length}`);
      discardedOutbound.push(flow);
    } else {
      debug(`<${id}> outbound <${flow.id}> taken - pending ${pendingOutbound.length}`);
    }

    if (pendingOutbound.length === 0) {
      if (discardedOutbound.length === outbound.length) {
        return completeCallback(new ActivityError(`No conditional flow was taken from <${id}>`, activityApi));
      }
      return completeCallback(null, flow);
    }
  }

  function getDiscardedOutbound() {
    if (!resumed) return [];
    if (!state.discardedOutbound) return [];
    return state.discardedOutbound.map((discardedId) => outbound.find((flow) => flow.id === discardedId));
  }

  function getPendingOutbound() {
    if (!resumed) return outbound.slice();
    if (!state.pendingOutbound) return outbound.slice();
    return state.pendingOutbound.map((pendingId) => outbound.find((flow) => flow.id === pendingId));
  }

  function reset() {
    deactivateOutbound();
    discardedOutbound = [];
    resumed = false;
  }

  function asyncEmitLeave(...args) {
    debug(`<${id}> async leave`);
    immediateLeave = setImmediate(emit, 'leave', ...args);
  }

  function startPendingDiscard(inboundFlow, rootFlow) {
    if (pendingDiscard) return;

    pendingDiscard = setImmediate(() => {
      activityExecution = ActivityExecution(gateway, null, environment, inboundFlow, rootFlow);
      enter(activityExecution);
      discardAllOutbound(rootFlow);
    });
  }

  function stopPendingDiscard() {
    if (!pendingDiscard) return;
    pendingDiscard = clearImmediate(pendingDiscard);
  }

  function getApi(executionContext) {
    return Api(executionContext);

    function Api() {
      return {
        id,
        type,
        cancel,
        discard,
        getInput: executionContext.getInput,
        getOutput: executionContext.getOutput,
        getState: getExecutingState,
        signal: executionContext.signal,
        stop: apiStop
      };

      function getExecutingState() {
        return Object.assign(executionContext.getState(), getState());
      }

      function cancel() {
        state.canceled = true;
        debug(`<${id}> cancel`);
        emit('cancel', activityApi, executionContext);
        complete(executionContext);
        executionContext.stop();
      }

      function discard() {
        executionContext.stop();
        discardAllOutbound(executionContext);
      }

      function apiStop() {
        executionContext.stop();
        deactivate();
      }
    }
  }
};
