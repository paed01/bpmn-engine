'use strict';

const debug = require('debug')('bpmn-engine:gateway:inclusiveGateway');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function(variables) {
  Activity.prototype.run.call(this);

  debug(`<${this.id}>`, 'run');
  this.emit('start', this);
  takeAll.call(this, this.outbound, variables);
};

function takeAll(outbound, variables) {
  debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);
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
      debug(`<${this.activity.id}>`, `take default sequence flow <${defaultFlow.id}>`);
      defaultFlow.take(variables);
    } else {
      defaultFlow.discard(variables);
    }
  } else {
    if (!taken) {
      this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`));
    }
  }

  setImmediate(this.emit.bind(this, 'end', this));
}
