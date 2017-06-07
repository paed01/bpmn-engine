'use strict';

const Activity = require('../activities/Activity');

function StartEvent(activity, parent) {
  Activity.call(this, activity, parent);
  this.isStart = true;
  this.isStartEvent = true;
}

module.exports = StartEvent;

StartEvent.prototype = Object.create(Activity.prototype);

StartEvent.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}>`, 'execute');

  if (this.form || this.hasInboundMessage) {
    this.emit('start', executionContext.getActivityApi({
      waiting: true
    }));
    this.waiting = true;

    return this.emit('wait', executionContext.postpone(callback));
  }
  this.emit('start', executionContext.getActivityApi());

  return callback();
};
