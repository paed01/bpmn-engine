'use strict';

const debug = require('debug');
const EventEmitter = require('events').EventEmitter;

function Flow(activity, parentContext) {
  this.id = activity.element.id;
  this.type = activity.element.$type;
  this.activity = activity;
  this.parentContext = parentContext;
  this.sourceId = activity.id;
  this.targetId = this.parentContext.getSequenceFlowTargetId(this.id);

  this.taken = false;

  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);

  this._debug(`<${this.id}> init, <${this.sourceId}> -> <${this.targetId}>`);
}

Flow.prototype = Object.create(EventEmitter.prototype);

Flow.prototype.take = function() {
  this.taken = true;
  this.discarded = false;
  delete this.looped;
  this._debug(`<${this.id}> taken, target <${this.targetId}>`);
  asyncEmitEvent.call(this, 'taken');
  return this.taken;
};

Flow.prototype.discard = function(rootFlow) {
  if (rootFlow && rootFlow.sourceId === this.targetId) {
    this._debug(`<${this.id}> detected loop <${rootFlow.sourceId}>. Stop.`);
    this.looped = true;
    this.emit('looped', this, rootFlow);
    return;
  }

  this._debug(`<${this.id}> discarded, target <${this.targetId}>`);
  delete this.looped;
  this.discarded = true;
  asyncEmitEvent.call(this, 'discarded', rootFlow || this);
};

function asyncEmitEvent(eventName, rootFlow) {
  // this.emit(eventName, this, rootFlow);
  setImmediate(() => {
    this.emit(eventName, this, rootFlow);
  });
}

module.exports = Flow;
