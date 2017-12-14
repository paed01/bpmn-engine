'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');

module.exports = function ParallelGateway(activity, parentContext) {
  const {id, type, inbound, outbound} = activity;
  const join = inbound.length > 1;
  const fork = outbound.length > 1;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  const {environment} = parentContext;
  const emit = (...args) => activity.emit(...args);

  const gatewayApi = Object.assign(activity, {
    join,
    fork,
    activate: activateGateway,
    run: runGateway
  });

  return gatewayApi;

  function runGateway(message) {
    return activateGateway().run(message);
  }

  function activateGateway(state) {
    let resumed = false;
    let activityExecution, flowManager;

    state = state || {
      id,
      type
    };

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

    function activate() {
      inbound.forEach((flow) => {
        flow.on('taken', onInbound);
        flow.on('discarded', onInbound);
      });
    }

    function deactivate() {
      inbound.forEach((flow) => {
        flow.removeListener('taken', onInbound);
        flow.removeListener('discarded', onInbound);
      });
    }

    function run(message, inboundFlow, rootFlow) {
      activityExecution = ActivityExecution(gatewayApi, null, environment, inboundFlow);
      flowManager = FlowManager(activityExecution, inboundFlow, rootFlow);
      return activityApi;
    }

    function resume() {
      if (!state.entered) return;
      resumed = true;
      return run();
    }

    function FlowManager(executionContext, startFlow, startRootFlow) {
      let entered, pendingOutbound;

      let pendingJoin = inbound && inbound.length > 1;
      let pendingFork = outbound && outbound.length > 1;
      const pendingInbound = getPendingInbound();
      const discardedInbound = getDiscardedInbound();

      executionContext.addStateSource(getPendingState);
      executionContext.addStopFn(deactivateOutbound);

      if (startFlow) {
        continueInbound(startFlow, startRootFlow);
      } else if (resumed) {
        emitEnter(executionContext);
      }
      if (!startFlow && pendingFork) {
        takeOutbound();
      }

      return {
        continueInbound,
        discardOutbound
      };

      function emitEnter() {
        if (entered) return;
        enter(executionContext);
        entered = true;
      }

      function continueInbound(inboundFlow, rootFlow) {
        const pendingIndex = pendingInbound.indexOf(inboundFlow);
        if (pendingIndex > -1) {
          pendingInbound.splice(pendingIndex, 1);
        } else {
          return completeCallback(new Error(`<${id}> non pending join inbound ${inboundFlow.id} was taken`), executionContext);
        }
        if (inboundFlow.discarded) {
          discardedInbound.push(inboundFlow);
        }

        emitEnter();

        (inboundFlow.discarded ? onDiscardedInbound : onTakenInbound)(inboundFlow, rootFlow);

        if (pendingInbound.length === 0) {
          pendingJoin = false;
          if (discardedInbound.length === inbound.length) {
            return discardOutbound(rootFlow);
          }

          return takeOutbound();
        }
      }

      function onTakenInbound(flow) {
        if (pendingJoin) {
          emit('start', activityApi, activityExecution);
          debug(`<${id}> continue from <${flow.id}> - pending ${pendingInbound.length}`);
        }
      }

      function onDiscardedInbound(flow) {
        debug(`<${id}> continue from discarded <${flow.id}> - pending ${pendingInbound.length}`);
      }

      function discardOutbound(rootFlow) {
        if (!pendingOutbound) pendingOutbound = getPendingOutbound();
        emit('leave', activityApi, executionContext);
        pendingOutbound.forEach((flow) => flow.discard(rootFlow));
        state.entered = undefined;
        completeCallback(null, executionContext);
      }

      function takeOutbound() {
        if (!pendingFork) {
          state.taken = true;
          emit('end', activityApi, executionContext);
          debug(`<${id}> take all outbound`);
          executionContext.takeAllOutbound();
          asyncEmitLeave(executionContext);
          return completeCallback(null, executionContext);
        }

        debug(`<${id}> start fork`);

        activateOutbound();

        emit('start', activityApi, activityExecution);
        pendingOutbound.forEach((flow) => flow.take());
      }

      function getPendingState() {
        const result = {};
        if (pendingJoin) {
          result.entered = true;
          result.pendingJoin = true;
          result.pendingInbound = pendingInbound.map((flow) => flow.id);
          result.discardedInbound = discardedInbound.map((flow) => flow.id);
        }
        if (pendingFork) {
          result.entered = true;
          result.pendingFork = pendingFork;
          if (pendingOutbound) {
            result.pendingOutbound = pendingOutbound.map((flow) => flow.id);
          }
        }

        return result;
      }

      function activateOutbound() {
        pendingOutbound = getPendingOutbound();
        pendingOutbound.forEach((flow) => {
          flow.on('taken', onOutbound);
        });
      }

      function onOutbound(flow) {
        const pendingIndex = pendingOutbound.indexOf(flow);
        if (pendingIndex > -1) {
          flow.removeListener('taken', onOutbound);
          pendingOutbound.splice(pendingIndex, 1);
        }

        if (pendingFork) {
          debug(`<${id}> outbound <${flow.id}> taken - pending ${pendingOutbound.length}`);
        }

        if (pendingOutbound.length === 0) {
          pendingFork = false;
          state.taken = true;
          emit('end', activityApi, executionContext);
          asyncEmitLeave(executionContext);
          return completeCallback();
        }
      }

      function deactivateOutbound() {
        if (!pendingOutbound) return;
        pendingOutbound.forEach((flow) => {
          flow.removeListener('taken', onOutbound);
        });
      }

      function getPendingInbound() {
        if (!inbound) return [];
        if (resumed && state.pendingInbound) {
          return state.pendingInbound.map((flowId) => inbound.find((flow) => flow.id === flowId));
        }
        return inbound.slice();
      }

      function getDiscardedInbound() {
        if (!inbound) return;
        if (resumed && state.discardedInbound) {
          return state.discardedInbound.map((flowId) => outbound.find((flow) => flow.id === flowId));
        }
        return [];
      }

      function getPendingOutbound() {
        if (!outbound) return;
        if (resumed && state.pendingOutbound) {
          return state.pendingOutbound.map((flowId) => outbound.find((flow) => flow.id === flowId));
        }
        return outbound.slice();
      }
    }

    function enter(executionContext) {
      debug(`<${id}> enter`);
      emit('enter', activityApi, executionContext);
    }

    function stop() {
      deactivate();
    }

    function getState() {
      return Object.assign({}, state);
    }

    function onInbound(flow, rootFlow) {
      if (!flowManager) return run(null, flow, rootFlow);
      flowManager.continueInbound(flow, rootFlow);
    }

    function completeCallback(err, executionContext) {
      if (err) return emit('error', err, activityApi, executionContext);
      flowManager = null;
    }

    function getApi(executionContext) {
      return Api(executionContext);

      function Api() {
        return {
          id,
          type,
          getInput: executionContext.getInput,
          getOutput: executionContext.getOutput,
          getState: getExecutingState,
          signal: executionContext.signal,
          stop: apiStop
        };

        function getExecutingState() {
          return Object.assign(executionContext.getState(), getState());
        }

        function apiStop() {
          executionContext.stop();
          deactivate();
        }
      }
    }

    function asyncEmitLeave(executionContext) {
      debug(`<${id}> async leave`);
      setImmediate(emit, 'leave', activityApi, executionContext);
    }
  }
};
