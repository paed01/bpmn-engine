'use strict';

const Activity = require('../activities/Activity');

function InclusiveGateway() {
  Activity.apply(this, arguments);
}

InclusiveGateway.prototype = Object.create(Activity.prototype);

InclusiveGateway.prototype.execute = function(executionContext, callback) {
  this._debug(`<${this.id}>`, 'execute');
  this.emit('start', executionContext.getActivityApi());

  const outbound = this.outbound;
  const input = executionContext.getInput();
  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);
  const takenFlows = [];
  const discardFlows = [];

  this._debug(`<${this.id}> take ${this.outbound.length} sequence flows`);

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (sequenceFlow.evaluateCondition(input)) {
      takenFlows.push(sequenceFlow);
    } else {
      discardFlows.push(sequenceFlow);
    }
  }

  if (!takenFlows.length && defaultFlow) {
    this._debug(`<${this.id}> take default flow <${defaultFlow.id}>`);
    defaultFlow.take();
    conditionalFlows.forEach((flow) => flow.discard());
  } else if (takenFlows.length) {
    if (defaultFlow) discardFlows.push(defaultFlow);
    takenFlows.forEach((flow) => {
      this._debug(`<${this.id}> take conditional flow <${flow.id}>`);
      flow.take();
    });
    discardFlows.forEach((flow) => flow.discard());
  } else {
    return callback(new Error(`No conditional flow was taken from <${this.id}>`));
  }

  return callback();
};

InclusiveGateway.prototype.takeAllOutbound = function() {
  this.leave();
};

module.exports = InclusiveGateway;
