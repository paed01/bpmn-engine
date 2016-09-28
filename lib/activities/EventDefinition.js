'use strict';

const debug = require('debug');
const Activity = require('./Activity');
const util = require('util');

const internals = {};

module.exports = internals.EventDefinition = function() {
  Activity.apply(this, arguments);
  this.eventDefinition = this.activity.eventDefinitions[0];
  this.type = this.eventDefinition.$type;
  this._debug = debug(`bpmn-engine:${this.type.toLowerCase()}`);

  this.cancelActivity = this.activity.hasOwnProperty('cancelActivity') ? this.activity.cancelActivity : true;
};

util.inherits(internals.EventDefinition, Activity);

internals.EventDefinition.prototype.run = function() {
  Activity.prototype.run.apply(this, arguments);

  this._debug(`<${this.id}>`, 'run');
  this.emit('start', this);
};

internals.EventDefinition.prototype.complete = function(message) {
  this._debug(`<${this.id}>`, 'completed');
  this.emit('end', this, message);
  if (this.attachedTo && this.cancelActivity) {
    this._debug(`<${this.id}>`, `discard <${this.attachedTo.id}>`);
    this.attachedTo.discard();
  }
  this.takeAllOutbound();
};

internals.EventDefinition.prototype.onAttachedStart = function(activity) {
  this._debug(`<${this.id}>`, `<${activity.id}> started`);
  this.run();
};

internals.EventDefinition.prototype.onAttachedEnd = function(activity) {
  this._debug(`<${this.id}>`, `<${activity.id}> ended`);
  this.discard();
};

internals.EventDefinition.prototype.onAttachedCancel = function(activity) {
  this._debug(`<${this.id}>`, `<${activity.id}> canceled`);
  this.discard();
};

internals.EventDefinition.prototype.onAttachedError = function(err, activity) {
  this._debug(`<${this.id}>`, `<${activity.id}> threw error:`, err.message);
  this.discard();
};

internals.EventDefinition.prototype.setupInboundListeners = function() {
  if (this.attachedTo) {
    this._onAttachedStart = this.onAttachedStart.bind(this);
    this._onAttachedEnd = this.onAttachedEnd.bind(this);
    this._onAttachedCancel = this.onAttachedCancel.bind(this);
    this._onAttachedError = this.onAttachedError.bind(this);
    this.attachedTo.on('start', this._onAttachedStart);
    this.attachedTo.on('end', this._onAttachedEnd);
    this.attachedTo.on('cancel', this._onAttachedCancel);
    this.attachedTo.on('error', this._onAttachedError);
  }
  Activity.prototype.setupInboundListeners.apply(this, arguments);
};

internals.EventDefinition.prototype.teardownInboundListeners = function() {
  if (this.attachedTo) {
    this.attachedTo.removeListener('start', this._onAttachedStart);
    this.attachedTo.removeListener('end', this._onAttachedEnd);
    this.attachedTo.removeListener('cancel', this._onAttachedCancel);
    this.attachedTo.removeListener('error', this._onAttachedError);
  }
  Activity.prototype.teardownInboundListeners.apply(this, arguments);
};
