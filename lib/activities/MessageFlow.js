'use strict';

const Flow = require('./Flow');
const util = require('util');

const internals = {};

module.exports = internals.Flow = function() {
  Flow.apply(this, arguments);
  this.outboundMessage = true;
};

util.inherits(internals.Flow, Flow);

internals.Flow.prototype.take = function(message) {
  const taken = Flow.prototype.take.apply(this, arguments);
  this._debug(`<${this.id}>`, 'send message:', message);
  this.emit('message', message, this);
  return taken;
};
