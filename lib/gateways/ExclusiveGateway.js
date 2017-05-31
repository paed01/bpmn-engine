'use strict';

const Activity = require('../activities/Activity');

function ExclusiveGateway() {
  Activity.apply(this, arguments);
}

ExclusiveGateway.prototype = Object.create(Activity.prototype);

ExclusiveGateway.prototype.execute = function(executionContext, callback) {
  const input = this.getInput();
  const outbound = this.outbound;
  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);
  const discardFlows = [];
  let takenFlow;

  this.emit('start', executionContext.getActivityApi());
  this.taken = true;

  this._debug(`<${this.id}> take ${outbound.length} sequence flows`);

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (!takenFlow && sequenceFlow.evaluateCondition(input)) {
      takenFlow = sequenceFlow;
    } else {
      discardFlows.push(sequenceFlow);
    }
  }

  if (!takenFlow && defaultFlow) {
    this._debug(`<${this.id}> take default flow <${defaultFlow.id}>`);
    defaultFlow.take();
    conditionalFlows.forEach((flow) => flow.discard());
  } else if (takenFlow) {
    if (defaultFlow) discardFlows.push(defaultFlow);
    this._debug(`<${this.id}> take conditional flow <${takenFlow.id}>`);
    takenFlow.take();
    discardFlows.forEach((flow) => flow.discard());
  } else {
    return callback(new Error(`No conditional flow was taken from <${this.id}>`));
  }

  return callback();
};

ExclusiveGateway.prototype.takeAllOutbound = function() {
  this.leave();
};

module.exports = ExclusiveGateway;
