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
  return DecisionGateway(gateway, execute, state);

  function execute(activityApi, executionContext, callback) {
    const pendingOutbound = executionContext.getPendingOutbound();
    const defaultFlowIdx = pendingOutbound.findIndex(({isDefault}) => isDefault);
    const gatewayInput = executionContext.getContextInput();
    let conditionMet = false;
    pendingOutbound.forEach((flow, idx) => {
      if (idx === defaultFlowIdx) {
        if (conditionMet) return flow.discard();
        else return flow.take();
      }
      if (flow.evaluateCondition(gatewayInput)) {
        conditionMet = true;
        flow.take();
      } else {
        flow.discard();
      }
    });
    callback();
  }
};
