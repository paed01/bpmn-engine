'use strict';

const DecisionGateway = require('./decision-gateway-activity');

module.exports = function ExclusiveGateway(activity, parentContext) {
  return DecisionGateway(activity, parentContext, evaluateAllOutbound);

  function evaluateAllOutbound(outbound, executionContext) {
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
  }
};
