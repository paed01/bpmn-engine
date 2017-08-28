'use strict';

const DecisionGateway = require('./decision-gateway-activity');
const {EventEmitter} = require('events');

function InclusiveGateway(activity) {
  Object.assign(this, activity);
}

InclusiveGateway.prototype = Object.create(EventEmitter.prototype);

module.exports = InclusiveGateway;

InclusiveGateway.prototype.activate = function(state) {
  const gateway = this;

  state = state || {};
  return DecisionGateway(gateway, evaluateAllOutbound, state);

  function evaluateAllOutbound(outbound, executionContext, callback) {
    const gatewayInput = executionContext.getContextInput();
    let defaultFlow, conditionMet = false;

    outbound.forEach((flow) => {
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
};
