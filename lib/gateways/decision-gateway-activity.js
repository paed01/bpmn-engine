'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {ActivityError} = require('../errors');

module.exports = function DecisionGateway(activity, parentContext, evaluateOutbound) {
  const {id, type, inbound, outbound, flows} = activity;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  const {environment} = parentContext;
  const emit = (...args) => activity.emit(...args);

  const gatewayApi = Object.assign(activity, {
    activate: activateGateway,
    run: runGateway
  });

  return gatewayApi;

  function runGateway(message) {
    return activateGateway().run(message);
  }

  function activateGateway(state) {
    let entered, started, taken;
    let activityExecution;

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
        .on('inbound-discarded', onInboundDiscarded);
    }

    function run(message) {
      enter(message);
      start();
      return activityApi;
    }

    function resume() {
      if (!state.entered || state.taken) return;

      flows.resume(state);

      return run();
    }

    function onInboundTaken() {
      enter();
      start();
    }

    function onInboundDiscarded(f) {
      if (!enter()) {
        console.log('IGNORE', f.id)
        return;
      }

      flows.once('all-outbound-discarded', onAllOutboundDiscarded);

      flows.discardAllOutbound();
    }

    function start() {
      if (started) return;
      started = true;

      debug(`<${id}> start`);
      emit('start', activityApi, activityExecution);

      const {outbound: pendingOutbound} = flows.pending();
      if (!pendingOutbound) return completeTaken();
      flows
        .once('all-outbound-taken', onAllOutboundTaken)
        .once('all-outbound-discarded', onTakenButAllOutboundDiscarded);

      evaluateOutbound(pendingOutbound, activityExecution);
    }

    function enter(message) {
      if (entered) return;
      entered = true;
      activityExecution = ActivityExecution(gatewayApi, message, environment);

      debug(`<${id}> enter`);
      emit('enter', activityApi, activityExecution);
      return true;
    }

    function onAllOutboundTaken() {
      flows
        .removeListener('all-outbound-taken', onAllOutboundTaken)
        .removeListener('all-outbound-discarded', onAllOutboundDiscarded);
      completeTaken();
    }

    function onTakenButAllOutboundDiscarded() {
      return emit('error', new ActivityError(`No conditional flow was taken from <${id}>`, activityApi));
    }

    function onAllOutboundDiscarded() {
      flows
        .removeListener('all-outbound-discarded', onAllOutboundDiscarded);

      emit('leave', activityApi, activityExecution);
    }

    function deactivate() {
      flows.deactivate()
        .removeListener('inbound-taken', onInboundTaken)
        .removeListener('inbound-discarded', onInboundDiscarded)
        .removeListener('all-outbound-taken', onAllOutboundTaken)
        .removeListener('all-outbound-discarded', onAllOutboundDiscarded)
        .removeListener('all-outbound-discarded', onTakenButAllOutboundDiscarded);
    }

    function completeTaken() {
      taken = true;
      entered = undefined;
      started = false;
      debug(`<${id}> end`);
      emit('end', activityApi, activityExecution);
      asyncEmitLeave(activityExecution);
    }

    function getState() {
      const result = {
        id,
        type,
        entered
      };

      if (taken) {
        result.taken = true;
      }
      if (entered) {
        const {pendingOutbound, discardedOutbound} = flows.getState();
        Object.assign(result, {pendingOutbound, discardedOutbound});
      }

      return result;
    }

    function stop() {
      debug(`<${id}> stop`);
      deactivate();
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
        }

        function discard() {
          debug(`<${id}> discard`);
        }
      }
    }

    function asyncEmitLeave(executionContext) {
      debug(`<${id}> async leave`);
      setImmediate(emit, 'leave', activityApi, executionContext);
    }
  }
};
