'use strict';

const Activity = require('../activities/Activity');

function InclusiveGateway() {
  Activity.apply(this, arguments);
}

InclusiveGateway.prototype = Object.create(Activity.prototype);

InclusiveGateway.prototype.run = function() {
  Activity.prototype.run.call(this);

  this._debug(`<${this.id}>`, 'run');
  this.emit('start', this);
  takeAll.call(this, this.outbound, this.parentContext.variables);
};

function takeAll(outbound) {
  this._debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);
  const input = this.getInput();

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  const takenFlows = [];
  const discardFlows = [];

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
    return this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`), this);
  }

  this.leave();
}

module.exports = InclusiveGateway;
