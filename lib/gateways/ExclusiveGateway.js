'use strict';

const DecisionGateway = require('./decision-gateway-activity');
const {EventEmitter} = require('events');

function ExclusiveGateway(activity) {
  Object.assign(this, activity);
}

ExclusiveGateway.prototype = Object.create(EventEmitter.prototype);

module.exports = ExclusiveGateway;

ExclusiveGateway.prototype.run = function(message) {
  return this.activate().run(message);
};

ExclusiveGateway.prototype.activate = function(state) {
  const gateway = this;

  return DecisionGateway(gateway, execute, state);

  function execute(activityApi, executionContext, callback) {
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
  }
};
