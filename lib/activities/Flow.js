'use strict';

const debug = require('debug');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Flow = function(activity, parentContext) {
  this.id = activity.element.id;
  this.type = activity.element.$type;
  this.activity = activity;
  this.parentContext = parentContext;
  this.sourceId = activity.id;
  this.targetId = this.parentContext.getSequenceFlowTargetId(this.id);

  this.taken = false;

  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);

  this._debug(`<${this.id}>`, `init, <${this.sourceId}> -> <${this.targetId}>`);
};

util.inherits(internals.Flow, EventEmitter);

internals.Flow.prototype.take = function() {
  this.taken = true;
  this.discarded = false;
  this._debug(`<${this.id}>`, `taken, target <${this.targetId}>`);
  asyncEmitEvent.call(this, 'taken');
  return this.taken;
};

internals.Flow.prototype.discard = function(rootFlow) {
  if (rootFlow && rootFlow.sourceId === this.targetId) {
    this._debug(`<${this.id}>`, `detected loop <${rootFlow.sourceId}>. Stop.`);
    return;
  }

  this._debug(`<${this.id}>`, `discarded, target <${this.targetId}>`);
  this.discarded = true;
  asyncEmitEvent.call(this, 'discarded', rootFlow);
};

function asyncEmitEvent(eventName, variables, rootFlow) {
  setImmediate(() => {
    this.emit(eventName, this, rootFlow);
  });
}
