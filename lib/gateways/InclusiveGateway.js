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

function takeAll(outbound, variables) {
  this._debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);
  let taken = false;

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (sequenceFlow.take(variables)) {
      taken = true;
    }
  }

  if (defaultFlow) {
    if (!taken) {
      this._debug(`<${this.activity.id}>`, `take default sequence flow <${defaultFlow.id}>`);
      defaultFlow.take(variables);
    } else {
      defaultFlow.discard(variables);
    }
  } else {
    if (!taken) {
      this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`), this);
    }
  }

  this.emit('end', this);

  this.leave();
}

module.exports = InclusiveGateway;
