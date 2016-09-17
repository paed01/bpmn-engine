'use strict';

const debug = require('debug')('bpmn-engine:activity:sequenceFlow');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Flow = function(activity, parentContext) {
  this.id = activity.element.id;
  debug(`<${this.id}>`, 'init');

  this.parentContext = parentContext;
  this.activity = activity;

  this.sourceId = activity.id;
  this.targetId = this.parentContext.getSequenceFlowTargetId(this.id);

  this.isDefault = this.parentContext.isDefaultSequenceFlow(this.id);
  this.taken = false;
};

util.inherits(internals.Flow, EventEmitter);

internals.Flow.prototype.take = function() {
  if (this.activity.element.conditionExpression) {
    this.taken = this.executeCondition(this.parentContext.variables);
  } else {
    this.taken = true;
  }
  this.discarded = false;

  if (this.taken) {
    debug(`<${this.id}>`, `taken, target <${this.targetId}>`);
    asyncEmitEvent.call(this, 'taken');
  } else {
    return this.discard();
  }

  return this.taken;
};

internals.Flow.prototype.discard = function(rootFlow) {
  if (rootFlow && rootFlow.sourceId === this.targetId) {
    debug(`<${this.id}>`, `detected loop <${rootFlow.sourceId}>. Stop.`);
    return;
  }

  debug(`<${this.id}>`, `discarded, target <${this.targetId}>`);
  this.discarded = true;
  asyncEmitEvent.call(this, 'discarded', rootFlow);
};

internals.Flow.prototype.executeCondition = function(variables) {
  const script = new vm.Script(this.activity.element.conditionExpression.body, {
    filename: `${this.id}.condition`,
    displayErrors: true
  });
  const context = new vm.createContext({
    context: variables
  });
  const result = script.runInContext(context);
  debug(`<${this.id}>`, `condition result evaluated to ${result}`, variables);
  return result;
};

function asyncEmitEvent(eventName, variables, rootFlow) {
  setImmediate(() => {
    this.emit(eventName, this, rootFlow);
  });
}
