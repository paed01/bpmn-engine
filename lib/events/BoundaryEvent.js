'use strict';

const debug = require('debug')('bpmn-engine:event:boundaryEvent');
const Activity = require('../activities/Activity');
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
  this.isStart = false;
  this.eventDefinitions = loadEventDefinitions.call(this, activity.eventDefinitions);
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function(variables) {
  Activity.prototype.run.call(this, variables);

  debug(`<${this.id}>`, 'run');
  this.emit('start', this);
  runAll.call(this, this.eventDefinitions, variables);
};

internals.Activity.prototype.completed = function() {
  debug(`<${this.id}>`, 'completed');
  this.teardownDefinitionEventListeners();
  this.emit('end', this);
  this.takeAllOutbound();
};

internals.Activity.prototype.cancel = function() {
  debug(`<${this.id}>`, 'cancel');
  this.teardownDefinitionEventListeners();
  Activity.prototype.cancel.apply(this, arguments);
};

internals.Activity.prototype.onDefinitionEnd = function(eventDefinition) {
  this.completed(eventDefinition);
};

internals.Activity.prototype.setupDefinitionEventListeners = function() {
  if (this._onDefinitionEnd) return;

  this._onDefinitionEnd = this.onDefinitionEnd.bind(this);

  this.eventDefinitions.forEach((def) => {
    def.on('end', this._onDefinitionEnd);
    def.on('cancel', this._onDefinitionEnd);
  });
};

internals.Activity.prototype.teardownDefinitionEventListeners = function() {
  if (!this._onDefinitionEnd) return;

  this.eventDefinitions.forEach((def) => {
    def.removeListener('end', this._onDefinitionEnd);
    def.removeListener('cancel', this._onDefinitionEnd);
  });

  delete this._onDefinitionEnd;
};

function runAll(eventDefinitions, variables) {
  this.setupDefinitionEventListeners();

  eventDefinitions.forEach((def) => {
    def.run(variables);
  });
}

function loadEventDefinitions(eventDefinitions) {
  return eventDefinitions.map((ed) => new (mapper(ed))(ed, this));
}
