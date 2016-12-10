'use strict';

const Flow = require('./Flow');

const internals = {};

module.exports = internals.MessageFlow = function() {
  Flow.apply(this, arguments);
  this.outboundMessage = true;
};

internals.MessageFlow.prototype = Object.create(Flow.prototype);

internals.MessageFlow.prototype.take = function(message) {
  const taken = Flow.prototype.take.apply(this, arguments);
  this._debug(`<${this.id}>`, 'send message:', message);
  this.emit('message', message, this);
  return taken;
};
