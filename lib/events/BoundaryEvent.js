'use strict';

const Activity = require('../activities/Activity');
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity) {
  Activity.apply(this, arguments);
  this._debug(`<${this.id}>`, 'init');
  this.isStart = false;
  this.cancelActivity = activity.hasOwnProperty('cancelActivity') ? activity.cancelActivity : true;
  this.eventDefinitions = loadEventDefinitions.call(this, this.activity.eventDefinitions, this.parentContext);
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function() {
  Activity.prototype.run.apply(this, arguments);

  this._debug(`<${this.id}>`, 'run');
  this.emit('start', this);
  runAll.call(this, this.eventDefinitions);
};

internals.Activity.prototype.completed = function() {
  this._debug(`<${this.id}>`, 'completed');
  this.teardownDefinitionEventListeners();
  this.emit('end', this);
  this.takeAllOutbound();
};

internals.Activity.prototype.discard = function() {
  this.teardownDefinitionEventListeners(true);
  Activity.prototype.discard.apply(this, arguments);
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;
  this.emit('cancel', this);
  this.discard.apply(this, arguments);
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

internals.Activity.prototype.teardownDefinitionEventListeners = function(cancel) {
  if (!this._onDefinitionEnd) return;

  this.eventDefinitions.forEach((def) => {
    def.removeListener('end', this._onDefinitionEnd);
    def.removeListener('cancel', this._onDefinitionEnd);
    if (cancel) {
      def.cancel();
    }
  });

  delete this._onDefinitionEnd;
};

function runAll(eventDefinitions) {
  this.setupDefinitionEventListeners();

  eventDefinitions.forEach((def) => {
    def.run();
  });
}

function loadEventDefinitions(eventDefinitions, context) {
  return eventDefinitions.map((ed) => new (mapper(ed.$type))(ed, context));
}
