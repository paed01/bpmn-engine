'use strict';

const DecisionGateway = require('./decision-gateway-activity');

module.exports = function ExclusiveGateway(activity) {
  const {id, type} = activity;

  const api = Object.assign(activity, {
    activate,
    getState,
    run,
  });

  return api;

  function run(message) {
    return activate().run(message);
  }

  function activate(state) {
    return DecisionGateway(api, evaluateAllOutbound, state);
  }

  function evaluateAllOutbound(outbound, executionContext, callback) {
    const gatewayInput = executionContext.getInputContext();
    let defaultFlow, conditionMet = false;

    outbound.forEach((flow) => {
      if (conditionMet) {
        return flow.discard();
      }
      if (flow.isDefault) {
        defaultFlow = flow;
        return;
      }

      if (flow.evaluateCondition(gatewayInput)) {
        conditionMet = true;
        flow.take();
      } else {
        flow.discard();
      }
    });

    if (defaultFlow) {
      if (conditionMet) defaultFlow.discard();
      else defaultFlow.take();
    }

    callback();
  }

  function getState() {
    return {
      id,
      type
    };
  }
};
