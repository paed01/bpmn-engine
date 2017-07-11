'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');

function ExclusiveGateway(activity) {
  Object.assign(this, activity);
}

ExclusiveGateway.prototype = Object.create(EventEmitter.prototype);

module.exports = ExclusiveGateway;

ExclusiveGateway.prototype.run = function(message) {
  return this.activate().run(message);
};

ExclusiveGateway.prototype.resume = function(state) {
  return this.activate(state).run();
};

ExclusiveGateway.prototype.execute = function(executionContext, callback) {
  const pendingOutbound = executionContext.getPendingOutbound();
  const defaultFlowIdx = pendingOutbound.findIndex(({isDefault}) => isDefault);
  const gatewayInput = executionContext.getContextInput();
  let conditionMet = false;
  pendingOutbound.forEach((flow, idx) => {
    if (conditionMet) {
      return flow.discard();
    }
    if (idx === defaultFlowIdx) {
      return flow.take();
    }

    if (flow.evaluateCondition(gatewayInput)) {
      conditionMet = true;
      flow.take();
    } else {
      flow.discard();
    }
  });
  callback();
};

ExclusiveGateway.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const environment = scope.environment;
  const inbound = scope.inbound;
  const outbound = scope.outbound;
  let resumed = !!state;

  let activityExecution, immediateLeave, pendingOutbound, stopped;
  let discardedOutbound = getDiscardedOutbound();

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
    discard,
    getState,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function onInboundTaken(inboundFlow) {
    run(null, inboundFlow);
  }

  function run(message, inboundFlow) {
    activityExecution = ActivityExecution(scope, message, environment, inboundFlow);
    enter(activityExecution);

    if (stopped) return;

    activateOutbound();
    emit('start', activityApi, activityExecution);

    scope.execute(activityExecution, () => {
      debug(`<${id}> all flows evaluated`);
      state.taken = true;
      emit('end', activityApi, activityExecution);
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
    const result = Object.assign({}, state);

    if (pendingOutbound) {
      result.pendingOutbound = pendingOutbound.map(({id: flowId}) => flowId);
    }
    if (discardedOutbound.length) {
      result.discardedOutbound = discardedOutbound.map(({id: flowId}) => flowId);
    }

    if (activityExecution) {
      Object.assign(result, activityExecution.getState());
    }

    return result;
  }

  function activate() {
    stopped = false;
    inbound.forEach((flow) => {
      flow.on('taken', onInboundTaken);
      flow.on('discarded', onInboundDiscarded);
    });
  }

  function activateOutbound() {
    pendingOutbound = activityExecution.getPendingOutbound();
    pendingOutbound.forEach((flow) => {
      flow.on('taken', onOutbound);
      flow.on('discarded', onOutbound);
    });
  }

  function deactivate() {
    inbound.forEach((flow) => {
      flow.removeListener('taken', onInboundTaken);
      flow.removeListener('discarded', onInboundDiscarded);
    });
    deactivateOutbound();
    if (immediateLeave) clearImmediate(immediateLeave);
    immediateLeave = null;
  }

  function deactivateOutbound() {
    outbound.forEach((flow) => {
      flow.removeListener('taken', onOutbound);
      flow.removeListener('discarded', onOutbound);
    });
  }

  function onInboundDiscarded(inboundFlow, rootFlow) {
    activityExecution = ActivityExecution(scope, null, scope.getVariablesAndServices(), inboundFlow, rootFlow);
    enter(activityExecution);
    discardAllOutbound(rootFlow);
  }

  function enter(executionContext) {
    if (resumed) executionContext.applyState(state);
    if (!resumed && state.entered) return emit('error', new Error(`Already entered <${id}>`));

    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function discard() {
    return completeCallback(null, true);
  }

  function completeCallback(err) {
    delete state.entered;

    if (err) {
      return emit('error', err, scope);
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
        return completeCallback(new Error(`No conditional flow was taken from <${id}>`));
      }
      return completeCallback(null, flow);
    }
  }

  function getDiscardedOutbound() {
    if (!resumed) return [];
    if (!state.discardedOutbound) return [];
    return state.discardedOutbound.map((discardedId) => outbound.find((flow) => flow.id === discardedId));
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
};
