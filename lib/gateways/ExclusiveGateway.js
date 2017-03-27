'use strict';

const Activity = require('../activities/Activity');

function ExclusiveGateway() {
  Activity.apply(this, arguments);
}

ExclusiveGateway.prototype = Object.create(Activity.prototype);

ExclusiveGateway.prototype.run = function() {
  Activity.prototype.run.call(this);

  this.emit('start', this);
  this.emit('end', this, this.getOutput());
  this.taken = true;

  takeAll.call(this, this.outbound);
};

function takeAll(outbound) {
  this._debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);
  let taken = false;

  const input = this.getInput();

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (taken) {
      sequenceFlow.discard();
    } else {
      taken = sequenceFlow.take(input);
    }
  }

  if (defaultFlow) {
    if (!taken) {
      this._debug(`<${this.activity.id}>`, `take default sequence flow <${defaultFlow.id}>`);
      defaultFlow.take();
    } else {
      defaultFlow.discard();
    }
  } else {
    if (!taken) {
      this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`), this);
    }
  }

  this.leave();
}

module.exports = ExclusiveGateway;
