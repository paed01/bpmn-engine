'use strict';

const Activity = require('../activities/Activity');
const EvaluateOutbound = require('./evaluate-outbound');

function ExclusiveGateway() {
  Activity.apply(this, arguments);
}

ExclusiveGateway.prototype = Object.create(Activity.prototype);

module.exports = ExclusiveGateway;

ExclusiveGateway.prototype.execute = function(executionContext, callback) {
  const runContext = EvaluateOutbound(this, executionContext, (pendingOutbound, gatewayOutput) => {
    const defaultFlowIdx = pendingOutbound.findIndex(({isDefault}) => isDefault);

    let conditionMet = false;
    pendingOutbound.forEach((flow, idx) => {
      if (conditionMet) {
        return flow.discard();
      }
      if (idx === defaultFlowIdx) {
        return flow.take();
      }

      if (flow.evaluateCondition(gatewayOutput)) {
        conditionMet = true;
        flow.take();
      } else {
        flow.discard();
      }
    });
  }, callback);

  runContext.start();
};

ExclusiveGateway.prototype.takeAllOutbound = function() {
  this.taken = true;
  this.leave();
};
