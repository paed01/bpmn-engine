'use strict';

const Activity = require('../activities/Activity');
const EvaluateOutbound = require('./evaluate-outbound');

function InclusiveGateway() {
  Activity.apply(this, arguments);
}

InclusiveGateway.prototype = Object.create(Activity.prototype);

module.exports = InclusiveGateway;

InclusiveGateway.prototype.execute = function(executionContext, callback) {
  const runContext = EvaluateOutbound(this, executionContext, (pendingOutbound, gatewayOutput) => {
    const defaultFlowIdx = pendingOutbound.findIndex(({isDefault}) => isDefault);

    let conditionMet = false;
    pendingOutbound.forEach((flow, idx) => {
      if (idx === defaultFlowIdx) {
        if (conditionMet) return flow.discard();
        else return flow.take();
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

InclusiveGateway.prototype.takeAllOutbound = function() {
  this.taken = true;
  this.leave();
};


