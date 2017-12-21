'use strict';

const Debug = require('debug');
const {EventEmitter} = require('events');

module.exports = FlowManager;

function FlowManager(activity) {
  const {id, inbound, outbound, type} = activity;
  const debug = Debug(`bpmn-engine:flows:${type.toLowerCase()}`);
  let activated, inboundFlows, outboundFlows;

  const api = Object.assign(new EventEmitter(), {
    inbound,
    outbound,
    activate,
    deactivate,
    discard,
    resume,
    setState,
    getState,
    continue: continueFlows,
    pending: pendingFlows,
    takeAllOutbound,
    discardAllOutbound
  });

  function emit(eventName, ...args) {
    let resetFlows;
    switch (eventName) {
      case 'all-outbound-taken':
      case 'all-outbound-discarded':
        resetFlows = true;
        break;
    }

    api.emit(eventName, ...args);

    if (resetFlows) {
      inboundFlows.reset();
      outboundFlows.reset();
    }
  }

  return api;

  function activate() {
    if (!activated) {
      activated = true;
      inboundFlows = Flows('Inbound', inbound);
      outboundFlows = Flows('Outbound', outbound);
    }

    return api;
  }

  function resume(state) {
    setState(state);
    return api;
  }

  function setState(state) {
    activated = true;
    inboundFlows = Flows('Inbound', inbound, state);
    outboundFlows = Flows('Outbound', outbound, state);

    return api;
  }

  function pendingFlows() {
    if (!activated) return {};

    return {
      inbound: inboundFlows.pending(),
      outbound: outboundFlows.pending()
    };
  }

  function continueFlows() {
    if (!activated) return;

    if (inboundFlows.pending()) {
      inboundFlows.continue();
      return true;
    } else if (outboundFlows.pending()) {
      outboundFlows.continue();
      return true;
    }

    return false;
  }

  function getState() {
    if (!inboundFlows) return {};
    return Object.assign(inboundFlows.getState(), outboundFlows.getState());
  }

  function discard() {
    outboundFlows.discard(inboundFlows.getDiscardedFlow());
  }

  function deactivate() {
    if (!activated) return api;
    activated = false;
    inboundFlows.deactivate();
    outboundFlows.deactivate();
    return api;
  }

  function takeAllOutbound() {
    outboundFlows.takeAll();
  }

  function discardAllOutbound() {
    outboundFlows.discardAll(inboundFlows.getDiscardedFlow());
  }

  function Flows(FlowTypes, flows, initialState) {
    const flowtypes = FlowTypes.toLowerCase();
    let pendingFlows;
    const discarded = [], taken = [];
    let listening = false, lastTaken, lastDiscarded;

    reset(initialState);

    return {
      reset,
      getDiscardedFlow,
      deactivate: deactivateListener,
      discard: discardPending,
      getState: getListenerState,
      takeAll,
      discardAll,
      pending: getPendingFlows,
      continue: continuePending
    };

    function getPendingFlows() {
      if (!pendingFlows || !pendingFlows.length) return;
      return pendingFlows.slice();
    }

    function continuePending() {
      if (!pendingFlows) return;
      if (!pendingFlows.length) complete(emit);
    }

    function reset(state) {
      if (listening) {
        debug(`<${id}> reset ${flowtypes}`);
        deactivateListener();
      }

      if (state) setListenerState(state);
      else {
        pendingFlows = flows.slice();
        discarded.splice();
        taken.splice();
        lastTaken = undefined;
        lastDiscarded = undefined;
      }

      listening = true;
      pendingFlows.forEach((flow) => {
        flow
          .once('taken', onTaken)
          .once('discarded', onDiscarded);
      });
    }

    function onDiscarded(flow, ...args) {
      const pending = removePending(flow);
      if (pending === -1) return;

      lastDiscarded = flow;
      discarded.push(flow);

      emit(`${flowtypes}-discarded`, flow, ...args);
      if (pending === 0) complete(emit, flow, ...args);
    }

    function onTaken(flow, ...args) {
      const pending = removePending(flow);
      if (!removePending(pending, flow)) return;

      taken.push(flow);

      emit(`${flowtypes}-taken`, flow, ...args);
      if (pending === 0) complete(emit, flow, ...args);
    }

    function complete(emitter, flow, ...args) {
      if (discarded.length > 0 && flows.length === discarded.length) {
        debug(`<${id}> completed discarded ${flowtypes}`);
        emitter(`all-${flowtypes}-discarded`, flow, ...args);
      } else {
        debug(`<${id}> completed ${flowtypes}`);
        emitter(`all-${flowtypes}-taken`, flow, ...args);
      }
    }

    function removePending(flow) {
      const idx = pendingFlows.indexOf(flow);
      if (idx === -1) return idx;
      pendingFlows.splice(idx, 1);
      return pendingFlows.length;
    }

    function deactivateListener() {
      listening = false;
      pendingFlows.forEach((flow) => {
        flow
          .removeListener('taken', onTaken)
          .removeListener('discarded', onTaken);
      });
    }

    function getListenerState() {
      const result = {};
      if (pendingFlows.length) {
        result[`pending${FlowTypes}`] = pendingFlows.map(({id: flowId}) => flowId);
      }
      if (discarded.length) {
        result[`discarded${FlowTypes}`] = discarded.map(({id: flowId}) => flowId);
      }
      return result;
    }

    function setListenerState(state) {
      pendingFlows = [];

      const pendingState = state[`pending${FlowTypes}`];
      const discardedState = state[`discarded${FlowTypes}`];
      if (!pendingState && !discardedState) return;

      flows.forEach((flow) => {
        const flowId = flow.id;
        if (pendingState && pendingState.includes(flowId)) {
          pendingFlows.push(flow);
        } else if (discardedState && discardedState.includes(flowId)) {
          lastDiscarded = flow;
          discarded.push(flow);
        } else {
          lastTaken = flow;
          taken.push(flow);
        }
      });
    }

    function getDiscardedFlow() {
      return lastDiscarded || discarded[0];
    }

    function discardPending(rootFlow) {
      pendingFlows.forEach((flow) => {
        flow.discard(rootFlow);
      });
    }

    function takeAll() {
      if (!pendingFlows.length) complete(emit);
      pendingFlows.forEach((flow) => flow.take());
    }

    function discardAll(rootFlow) {
      if (!pendingFlows.length) complete(emit);
      pendingFlows.forEach((flow) => flow.discard(rootFlow));
    }

    function asyncEmit(eventName, ...args) {
      setImmediate(() => {
        emit(eventName, ...args);
      });
    }
  }
}
