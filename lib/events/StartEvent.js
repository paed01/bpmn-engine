'use strict';

const Activity = require('../activities/Activity');

function StartEvent(activity, parent) {
  Activity.call(this, activity, parent);
  this.isStart = true;
  this.isStartEvent = true;
  this.form = activity.form;
}

module.exports = StartEvent;

StartEvent.prototype = Object.create(Activity.prototype);

StartEvent.prototype.execute = function(executionContext, callback) {
  this._debug(`<${executionContext.id}>`, 'execute');

  if (this.form || this.hasInboundMessage) {
    const activityApi = executionContext.getActivityApi({
      waiting: true
    });
    this.emit('start', activityApi);

    return this.emit('wait', executionContext.postpone(callback));
  }
  this.emit('start', executionContext.getActivityApi());

  return callback();
};
