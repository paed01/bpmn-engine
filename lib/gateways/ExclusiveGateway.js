'use strict';

const Activity = require('../activities/Activity');

function ExclusiveGateway() {
  Activity.apply(this, arguments);
}

ExclusiveGateway.prototype = Object.create(Activity.prototype);

ExclusiveGateway.prototype.run = function() {
  Activity.prototype.run.call(this);

  const input = this.getInput();
  this.emit('start', this);
  this.emit('end', this, this.getOutput(input));
  this.taken = true;

  takeAll.call(this, this.outbound, input);
};

function takeAll(outbound, input) {
  this._debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  let takenFlow;
  const discardFlows = [];

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
    return this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`), this);
  }

  this.leave();
}

module.exports = ExclusiveGateway;
