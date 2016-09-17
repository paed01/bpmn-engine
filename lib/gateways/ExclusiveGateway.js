'use strict';

const debug = require('debug')('bpmn-engine:gateway:exclusiveGateway');
const Activity = require('../activities/Activity');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function() {
  Activity.apply(this, arguments);
  this._debug(`<${this.id}>`, 'init');
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function() {
  Activity.prototype.run.call(this);

  this.emit('start', this);
  this.emit('end', this);
  this.taken = true;

  takeAll.call(this, this.outbound, this.parentContext.variables);
};

function takeAll(outbound, variables) {
  this._debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);
  let taken = false;

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (taken) {
      sequenceFlow.discard();
    } else {
      taken = sequenceFlow.take(variables);
    }
  }

  if (defaultFlow) {
    if (!taken) {
      debug(`<${this.activity.id}>`, `take default sequence flow <${defaultFlow.id}>`);
      defaultFlow.take();
    } else {
      defaultFlow.discard();
    }
  } else {
    if (!taken) {
      this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`));
    }
  }

  this.leave();
}
