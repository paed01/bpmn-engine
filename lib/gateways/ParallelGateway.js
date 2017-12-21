'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');

module.exports = function ParallelGateway(activity, parentContext) {
  const {id, type, inbound, outbound, flows} = activity;
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
    let entered, started, taken;
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
      flows.activate()
        .on('inbound-taken', onInboundTaken)
        .on('inbound-discarded', onInboundDiscarded)
        .on('all-inbound-taken', onAllInboundTaken)
        .on('all-inbound-discarded', onAllInboundDiscarded);
    }

    function onInboundTaken() {
      enter();
      if (join) start();
    }

    function onInboundDiscarded() {
      enter();
    }

    function onAllInboundDiscarded() {
      enter();
      entered = undefined;
      debug(`<${id}> all inbound discarded`);
      emit('leave', activityApi, activityExecution);
      flows.discardAllOutbound();
    }

    function onAllInboundTaken() {
      enter();
      start();

      if (fork) {
        return continueFork();
      }

      flows.takeAllOutbound();
      completeTaken();
    }

    function continueFork() {
      debug(`<${id}> continue fork`);
      flows
        .on('outbound-taken', onOutboundTaken)
        .once('all-outbound-taken', onAllOutboundTaken);

      flows.takeAllOutbound();
    }

    function onOutboundTaken() {
      enter();
      start();
    }

    function onAllOutboundTaken() {
      flows
        .removeListener('outbound-taken', onOutboundTaken)
        .removeListener('all-outbound-taken', onAllOutboundTaken);
      enter();
      start();
      completeTaken();
    }

    function completeTaken() {
      taken = true;
      entered = undefined;
      debug(`<${id}> end`);
      emit('end', activityApi, activityExecution);
      asyncEmitLeave(activityExecution);
    }

    function start() {
      if (started) return;
      started = true;

      debug(`<${id}> start`);
      emit('start', activityApi, activityExecution);
    }

    function enter(message) {
      if (entered) return;
      entered = true;
      activityExecution = ActivityExecution(gatewayApi, message, environment);

      debug(`<${id}> enter`);
      emit('enter', activityApi, activityExecution);
    }

    function deactivate() {
      flows.deactivate()
        .removeListener('inbound-taken', onInboundTaken)
        .removeListener('inbound-discarded', onInboundDiscarded)
        .removeListener('all-inbound-taken', onAllInboundTaken)
        .removeListener('all-inbound-discarded', onAllInboundDiscarded)
        .removeListener('outbound-taken', onOutboundTaken)
        .removeListener('all-outbound-taken', onAllOutboundTaken);
    }

    function run(message) {
      enter(message);
      const {inbound: pendingInbound, outbound: pendingOutbound} = flows.pending();
      if (!pendingInbound && !pendingOutbound) {
        start();
        return completeTaken();
      } else if (fork) {
        onAllInboundTaken();
      }

      flows.continue();
    }

    function resume() {
      if (!state.entered || state.taken) return;

      flows.resume(state);

      return run();
    }

    function stop() {
      debug(`<${id}> stop`);
      deactivate();
    }

    function getState() {
      const result = {
        id,
        type,
        entered
      };

      if (join) {
        result.pendingJoin = true;
      }
      if (taken) {
        result.taken = true;
      }
      if (entered) {
        Object.assign(result, flows.getState());
      }

      return result;
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
          stop
        };

        function getExecutingState() {
          return Object.assign(executionContext.getState(), getState());
        }

        function cancel() {
          state.canceled = true;
          debug(`<${id}> cancel`);
          flowManager.cancel();
        }

        function discard() {
          debug(`<${id}> discard`);
          flowManager.discard();
        }
      }
    }

    function asyncEmitLeave(executionContext) {
      debug(`<${id}> async leave`);
      setImmediate(emit, 'leave', activityApi, executionContext);
    }
  }
};
