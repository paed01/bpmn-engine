'use strict';

const EventDefinition = require('../activities/EventDefinition');

function MessageEvent() {
  EventDefinition.apply(this, arguments);
}

MessageEvent.prototype = Object.create(EventDefinition.prototype);

MessageEvent.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}>`, 'execute');

  this.emit('start', executionContext.getActivityApi({
    waiting: true
  }));

  this.waiting = true;

  return this.emit('wait', executionContext.postpone(callback));
};

MessageEvent.prototype.signal = function() {};

module.exports = MessageEvent;
