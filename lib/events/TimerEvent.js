'use strict';

const EventDefinition = require('../activities/EventDefinition');
const expressions = require('../expressions');
const iso8601duration = require('iso8601-duration');

function TimerEvent(activity) {
  EventDefinition.apply(this, arguments);
  this.duration = activity.eventDefinition.timeDuration;
  this._debug(`<${this.id}> timeout ${this.duration}`);
}

TimerEvent.prototype = Object.create(EventDefinition.prototype);

module.exports = TimerEvent;

TimerEvent.prototype.execute = function(executionContext, callback) {
  const runContext = ExecuteTimer(this, executionContext, callback);

  runContext.start();

  // delete this.stoppedAt;
  // this.startedAt = new Date();

  // const executionApi = executionContext.postpone(callback);

  // const timeout = this.hasOwnProperty('timeout') ? this.timeout : resolveDuration.call(this, this.duration);
  // this._debug(`<${this.id}> run for duration ${timeout}ms`);

  // this.timer = setTimeout(() => {
  //   this._debug(`<${this.id}> timed out`);
  //   delete this.timeout;
  //   executionApi.complete();
  // }, this.timeout);

  // this.emit('start', executionApi);

  // EventDefinition.prototype.run.call(this);

  // console.log('KJAJSDLKASD')
};

function ExecuteTimer(activity, executionContext, callback) {
  const id = activity.id;
  const executionApi = executionContext.postpone(callback);
  const duration = activity.duration;

  let startedAt, stoppedAt, timer;

  const timeout = activity.hasOwnProperty('timeout') ? activity.timeout : resolveDuration();

  const activityApi = {
    id,
    getState,
    start,
    stop
  };

  return activityApi;

  function start() {
    activity._debug(`<${id}> run for duration ${timeout}ms`);

    startedAt = new Date();

    timer = setTimeout(() => {
      timer = null;
      stoppedAt = new Date();
      activity._debug(`<${id}> timed out`);
      executionApi.complete();
    }, duration);

    activity.emit('start', activityApi);
  }

  function stop() {
    if (timer) clearTimeout(timer);
    stoppedAt = stoppedAt || new Date();
    executionContext.stop();
  }

  function getState() {
    const stateStoppedAt = stoppedAt || new Date();
    const stateTimeout = timeout - (stateStoppedAt - startedAt);

    return executionContext.getState({
      timeout: stateTimeout
    });
  }

  function resolveDuration() {
    const isoDuration = executionContext.resolveExpression(duration);
    return iso8601duration.toSeconds(iso8601duration.parse(isoDuration)) * 1000;
  }

}

// TimerEvent.prototype.run = function() {
//   delete this.stoppedAt;
//   this.startedAt = new Date();

//   this.timeout = this.hasOwnProperty('timeout') ? this.timeout : resolveDuration.call(this, this.duration);
//   this._debug(`<${this.id}> run for duration ${this.timeout}ms`);

//   this.timer = setTimeout(() => {
//     this._debug(`<${this.id}> timed out`);
//     delete this.timeout;
//     this.complete();
//   }, this.timeout);

//   this.emit('start', this);

//   EventDefinition.prototype.run.call(this);
// };

TimerEvent.prototype.discard = function() {
  this._debug(`<${this.id}>`, `cancel timeout ${this.timeout}ms`);
  clearTimeout(this.timer);
  delete this.timer;
  EventDefinition.prototype.discard.call(this);
};

TimerEvent.prototype.onAttachedEnd = function(activity) {
  this._debug(`<${this.id}>`, `activity <${activity.id}> ended`);
  if (this.cancelActivity) this.discard();
};

TimerEvent.prototype.resume = function(state) {
  if (state.hasOwnProperty('timeout')) {
    this._debug(`<${this.id}>`, `resume from ${state.timeout}ms`);
    this.timeout = state.timeout;
  }
};

TimerEvent.prototype.deactivate = function() {
  EventDefinition.prototype.deactivate.apply(this, arguments);
  this.stoppedAt = new Date();
  if (this.timer) {
    clearTimeout(this.timer);
  }
};

TimerEvent.prototype.getState = function() {
  const state = EventDefinition.prototype.getState.apply(this, arguments);
  if (!this.entered) return state;

  const stoppedAt = this.stoppedAt || new Date();

  return Object.assign(state, {
    timeout: this.timeout - (stoppedAt - this.startedAt),
    attachedToId: this.attachedTo.id
  });
};

// function resolveDuration(duration) {
//   duration = expressions(duration, this.parentContext.getFrozenVariablesAndServices());
//   return iso8601duration.toSeconds(iso8601duration.parse(duration)) * 1000;
// }
