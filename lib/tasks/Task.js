'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');

const internals = {};

module.exports = internals.Task = function(activity, parent) {
  this.id = activity.id;
  this.type = activity.$type;
  this.activity = activity;
  this.boundEvents = parent.getBoundaryEvents(activity.id);

  this.inbound = parent.getInboundSequenceFlows(activity.id);
  this.outbound = parent.getOutboundSequenceFlows(activity.id);
  if (this.boundEvents.length) {
    this.boundEvents.forEach((e) => {
      this.outbound = this.outbound.concat(e.outbound);
      this.inbound = this.inbound.concat(e.inbound);
    });
  }

  this.isEnd = this.outbound.length === 0;

  this.listenForInbound();
};

util.inherits(internals.Task, EventEmitter);

internals.Task.prototype.run = function() {
  this.teardownInboundListeners();
};

internals.Task.prototype.cancel = function() {
  this.teardownInboundListeners();
};

internals.Task.prototype.listenForInbound = function() {
  if (!this.inbound.length) return;
  this.inbound.forEach((flow) => {
    flow.on('taken', this.run.bind(this));
    flow.on('discarded', this.cancel.bind(this));
  });
};

internals.Task.prototype.teardownInboundListeners = function() {
  if (!this.inbound.length) return;
  this.inbound.forEach((flow) => {
    flow.removeListener('taken', this.run.bind(this));
    flow.removeListener('discarded', this.cancel.bind(this));
  });
};
