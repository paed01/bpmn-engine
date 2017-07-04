'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');

function ParallelGateway(activity) {
  Object.assign(this, activity);
  this.isStart = !this.inbound || this.inbound.length === 0;
  this.join = this.inbound.length > 1;
  this.fork = this.outbound.length > 1;
}

ParallelGateway.prototype = Object.create(EventEmitter.prototype);

module.exports = ParallelGateway;

ParallelGateway.prototype.run = function(message) {
  return this.activate().run(message);
};

ParallelGateway.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const inbound = scope.inbound;
  const outbound = scope.outbound;
  let pendingJoin = inbound && inbound.length > 1;
  let pendingFork = outbound && outbound.length > 1;

  let activityExecution;

  state = state || {
    id,
    type
  };

  const pendingInbound = getPendingInbound();
  const pendingOutbound = getPendingOutbound();
  const discardedInbound = getDiscardedInbound();

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    // cancel,
    deactivate,
    discard,
    getState,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function run() {
    enter();
    if (!pendingJoin) return takeAllOutbound();
    return activityApi;
  }

  function enter(inboundFlow, rootFlow) {
    state.entered = true;
    debug(`<${id}> enter`);
    activityExecution = ActivityExecution(scope, null, scope.getVariablesAndServices(), inboundFlow, rootFlow);
    emit('enter', activityApi, activityExecution);
  }

  function stop() {
    deactivateOutbound();
    deactivate();
  }

  function resume() {
    if (!state.entered) return;
    run();
  }

  function getState() {
    const result = Object.assign({}, state);

    if (pendingJoin) {
      result.pendingJoin = true;
      result.pendingInbound = pendingInbound.map((flow) => flow.id);
      result.discardedInbound = discardedInbound.map((flow) => flow.id);
    }
    if (pendingFork) {
      result.pendingFork = pendingFork;
      result.pendingOutbound = pendingOutbound.map((flow) => flow.id);
    }

    return result;
  }

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

  function activateOutbound() {
    pendingOutbound.forEach((flow) => {
      flow.on('taken', onOutbound);
    });
  }

  function deactivateOutbound() {
    pendingOutbound.forEach((flow) => {
      flow.removeListener('taken', onOutbound);
    });
  }

  function discard(eventRootFlow) {
    deactivate();
    pendingOutbound.forEach((flow) => flow.discard(eventRootFlow));
    emit('leave', activityApi, activityExecution);
  }

  function onTaken(flow) {
    if (!state.entered) {
      enter();
    }
    if (pendingJoin) {
      state.taken = true;
      emit('start', activityApi, activityExecution);
      debug(`<${id}> continue from <${flow.id}> - pending ${pendingInbound.length}`);
    }
  }

  function onDiscarded(flow) {
    debug(`<${id}> continue from discarded <${flow.id}> - pending ${pendingInbound.length}`);
    discardedInbound.push(flow);
    if (!state.entered) {
      enter();
    }
  }

  function onInbound(flow, rootFlow) {
    const pendingIndex = pendingInbound.indexOf(flow);
    if (pendingIndex > -1) {
      pendingInbound.splice(pendingIndex, 1);
    } else {
      return emit('error', new Error(`<${id}> non pending join inbound ${flow.id} was taken`));
    }

    (flow.discarded ? onDiscarded : onTaken)(flow, rootFlow);

    if (pendingInbound.length === 0) {
      pendingJoin = false;
      if (discardedInbound.length === inbound.length) {
        return discard(rootFlow);
      }

      return takeAllOutbound();
    }
  }

  function onOutbound(flow, baseRootFlow) {
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
      return complete(flow, baseRootFlow);
    }
  }

  function complete() {
    state.taken = true;
    emit('end', activityApi, activityExecution);
    pendingOutbound.forEach((flow) => flow.take());
    delete state.entered;
    asyncEmitLeave(activityApi, activityExecution);
  }

  function takeAllOutbound() {
    if (!pendingFork) {
      return complete();
    }

    activateOutbound();

    emit('start', activityApi, activityExecution);
    pendingOutbound.forEach((flow) => flow.take());
  }

  function getPendingInbound() {
    if (!inbound) return [];
    if (state.pendingInbound) {
      return state.pendingInbound.map((flowId) => inbound.find((flow) => flow.id === flowId));
    }
    return inbound.slice();
  }

  function getDiscardedInbound() {
    if (!outbound) return;
    if (state.discardedInbound) {
      return state.discardedInbound.map((flowId) => outbound.find((flow) => flow.id === flowId));
    }
    return [];
  }

  function getPendingOutbound() {
    if (!outbound) return;
    if (state.pendingOutbound) {
      return state.pendingOutbound.map((flowId) => outbound.find((flow) => flow.id === flowId));
    }
    return outbound.slice();
  }

  function asyncEmitLeave(...args) {
    debug(`<${id}> async leave`);
    setImmediate(emit, 'leave', ...args);
  }
};

// ParallelGateway.prototype.run = function(message, inboundFlow, rootFlow) {
//   this.canceled = false;
//   this.taken = false;

//   const runContext = InboundExecution(this, message, this.parentContext.getVariablesAndServices(), inboundFlow, rootFlow);
//   const executionContext = runContext.executionContext;

//   this.teardownInboundListeners();

//   runContext.start((err, discarded) => {
//     if (err) return this.emit('error', err, this);
//     this.setupInboundListeners();

//     this.taken = true;

//     if (discarded) return this.leave();
//     this.complete(getTaskOutput(this.id, executionContext.hasOutputParameters, executionContext.getOutput()));
//   });
// };

// ParallelGateway.prototype.resume = function(state) {
//   if (state.hasOwnProperty('taken')) {
//     this.taken = state.taken;
//   }
//   if (state.hasOwnProperty('canceled')) {
//     this.canceled = state.canceled;
//   }

//   const runContext = InboundExecution(this, null, this.parentContext.getVariablesAndServices());
//   const executionContext = runContext.executionContext;
//   runContext.applyState(state);

//   if (!state.entered) return;

//   this._debug(`<${this.id}> resume`);

//   this.teardownInboundListeners();

//   runContext.start((err, discarded) => {
//     if (err) return this.emit('error', err, this);
//     this.setupInboundListeners();

//     this.taken = true;

//     if (discarded) return this.leave();
//     this.complete(getTaskOutput(this.id, executionContext.hasOutputParameters, executionContext.getOutput()));
//   });
// };

// ParallelGateway.prototype.execute = function(executionContext, callback) {
//   return executionContext.start(callback);
// };

// ParallelGateway.prototype.takeAllOutbound = function() {
//   this.leave();
// };

// ParallelGateway.prototype.onInbound = function(flow, rootFlow) {
//   this.run(null, flow, rootFlow);
// };

// function InboundExecution(activity, message, variablesAndServices, inboundFlow, rootFlow) {
//   const id = activity.id;
//   const type = activity.type;
//   const inbound = activity.inbound;
//   const executionContext = activityExecution(activity, message, variablesAndServices, inboundFlow, rootFlow);

//   let discardedInbound = [];
//   let entered, taken, executionApi, listenInbound, listenOutbound;
//   let pendingInbound = executionContext.getPendingInbound();
//   let pendingOutbound = executionContext.getPendingOutbound();

//   let pendingJoin = inbound.length > 1;
//   let pendingFork = activity.outbound.length > 1;

//   const runContext = {
//     id,
//     type,
//     applyState,
//     complete,
//     executionContext,
//     getActivityApi,
//     getState,
//     start,
//     stop
//   };

//   return runContext;

//   function start(callback) {
//     activate();
//     executionApi = executionContext.postpone(callback);

//     if (inboundFlow) {
//       return onInbound(inboundFlow, rootFlow);
//     }

//     enter();
//     if (!inbound.length || !pendingInbound.length) {
//       return takeAllOutbound();
//     }
//   }

//   function enter() {
//     entered = true;
//     activity.enter(runContext);
//     if (pendingJoin) {
//       activity.emit('start', getActivityApi());
//     }
//   }

//   function applyState(state) {
//     executionContext.applyState(state);

//     if (state.pendingJoin) {
//       pendingInbound = executionContext.getPendingInbound();
//     } else {
//       pendingInbound = [];
//     }

//     if (state.discardedInbound) {
//       discardedInbound = state.discardedInbound.map((flowId) => inbound.find((flow) => flowId === flow.id));
//     }
//     if (state.pendingFork) {
//       pendingFork = true;
//       pendingOutbound = executionContext.getPendingOutbound();
//     }
//   }

//   function getState() {
//     const state = executionContext.getState({
//       taken
//     });

//     if (pendingJoin) {
//       state.pendingJoin = pendingJoin;
//       state.pendingInbound = pendingInbound.map((flow) => flow.id);
//       state.discardedInbound = discardedInbound.map((flow) => flow.id);
//     }
//     if (pendingFork) {
//       state.pendingFork = pendingFork;
//       state.pendingOutbound = pendingOutbound.map((flow) => flow.id);
//     }

//     return state;
//   }

//   function getActivityState() {
//     return {
//       pendingJoin,
//       pendingInbound,
//       getState,
//       stop
//     };
//   }

//   function activate() {
//     if (pendingJoin) {
//       listenInbound = pendingInbound.slice();
//       listenInbound.forEach((flow) => {
//         flow.on('taken', onInbound);
//         flow.on('discarded', onInbound);
//       });
//     }
//     listenOutbound = pendingOutbound.slice();
//     listenOutbound.forEach((flow) => {
//       flow.on('taken', onOutbound);
//     });
//   }

//   function deactivate() {
//     if (listenInbound) {
//       listenInbound.forEach((flow) => {
//         flow.removeListener('taken', onInbound);
//         flow.removeListener('discarded', onInbound);
//       });
//     }
//     if (listenOutbound) {
//       listenOutbound.forEach((flow) => {
//         flow.removeListener('taken', onOutbound);
//       });
//     }
//   }

//   function complete() {
//     deactivate();
//     return setImmediate(executionApi.complete, null, false);
//   }

//   function discard(eventRootFlow) {
//     deactivate();
//     executionApi.complete(true);
//     pendingOutbound.forEach((flow) => flow.discard(eventRootFlow));
//   }

//   function onTaken(flow) {
//     if (!entered) {
//       enter();
//     } else if (pendingJoin) {
//       taken = true;
//       activity.emit('start', getActivityApi());
//     }
//     activity._debug(`<${id}> continue from <${flow.id}> - pending ${pendingInbound.length}`);
//   }

//   function onDiscarded(flow) {
//     activity._debug(`<${id}> continue from discarded <${flow.id}> - pending ${pendingInbound.length}`);
//     discardedInbound.push(flow);
//     if (!entered) {
//       entered = true;
//       activity.enter(runContext);
//     }
//   }

//   function onInbound(flow, inboundRootFlow) {
//     const pendingIndex = pendingInbound.indexOf(flow);
//     if (pendingIndex > -1) {
//       pendingInbound.splice(pendingIndex, 1);
//     }

//     (flow.discarded ? onDiscarded : onTaken)(flow, inboundRootFlow);

//     if (pendingInbound.length === 0) {
//       pendingJoin = false;
//       if (discardedInbound.length === inbound.length) {
//         return discard(inboundRootFlow);
//       }

//       return takeAllOutbound();
//     }
//   }

//   function takeAllOutbound() {
//     if (!pendingOutbound.length) {
//       return complete();
//     }

//     if (pendingFork) {
//       activity.emit('start', getActivityApi());
//     }

//     pendingOutbound.forEach((flow) => flow.take());
//   }

//   function onOutbound(flow, baseRootFlow) {
//     const pendingIndex = pendingOutbound.indexOf(flow);
//     if (pendingIndex > -1) {
//       pendingOutbound.splice(pendingIndex, 1);
//     }

//     if (pendingFork) {
//       activity._debug(`<${id}> outbound <${flow.id}> taken - pending ${pendingOutbound.length}`);
//     }

//     if (pendingOutbound.length === 0) {
//       taken = true;
//       return complete(flow, baseRootFlow);
//     }
//   }

//   function getActivityApi() {
//     return executionContext.getActivityApi(getActivityState());
//   }

//   function stop() {
//     deactivate();
//     return executionContext.stop();
//   }
// }
