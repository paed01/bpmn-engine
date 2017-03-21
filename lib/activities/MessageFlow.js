'use strict';

const Flow = require('./Flow');

function MessageFlow() {
  Flow.apply(this, arguments);
  this.outboundMessage = true;
}

MessageFlow.prototype = Object.create(Flow.prototype);

MessageFlow.prototype.take = function(message) {
  const taken = Flow.prototype.take.apply(this, arguments);
  this._debug(`<${this.id}>`, 'send message:', message);
  this.emit('message', message, this);
  return taken;
};

module.exports = MessageFlow;
