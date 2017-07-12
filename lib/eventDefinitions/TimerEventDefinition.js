'use strict';

const Debug = require('debug');
const iso8601duration = require('iso8601-duration');

module.exports = function TimerEventDefinition(eventDefinition, state) {
  const debug = Debug(`bpmn-engine:${eventDefinition.type.toLowerCase()}`);

  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const duration = eventDefinition.timeDuration;
  const cancelActivity = eventDefinition.cancelActivity;
  const eventState = Object.assign({
    id,
    type
  }, state);

  const activityApi = {
    id,
    type,
    duration,
    cancelActivity,
    getState,
    init
  };

  function getState() {
    const result = {};
    return result;
  }

  return activityApi;

  function init(boundApi, executionContext) {

    const isoDuration = executionContext.environment.resolveExpression(duration);
    const timeout = resolveDuration();

    eventState.timeout = timeout;

    let completeCallback, deactivated, startedAt, stoppedAt, timer;

    debug(`<${id}> run for duration ${timeout}ms`);

    return {
      cancelActivity,
      type,
      deactivate,
      getState: getExecutionState,
      start,
      stop
    };

    function start(callback) {
      if (deactivated) return;

      startedAt = new Date();
      completeCallback = callback;

      eventState.entered = true;
      eventState.startedAt = startedAt;

      timer = setTimeout(() => {
        timer = null;
        stoppedAt = new Date();
        debug(`<${id}> timed out`);
        complete();
      }, timeout);
    }

    function complete() {
      deactivate();
      completeCallback(null, cancelActivity);
    }

    function stop() {
      deactivate();
      stoppedAt = stoppedAt || new Date();
    }

    function deactivate() {


      deactivated = true;
      if (timer) {
        debug(`<${id}> stop timer`);
        clearTimeout(timer);
      }
      timer = null;
      delete eventState.entered;
    }

    function getExecutionState() {
      const remaining = getRemainingMs();

      const result = {
        timeout: remaining,
        duration: timeout
      };

      if (startedAt) {
        result.startedAt = startedAt;
      }
      if (stoppedAt) {
        result.stoppedAt = stoppedAt;
      }

      return result;
    }

    function getRemainingMs() {
      if (!startedAt) return timeout;
      const now = stoppedAt || new Date();

      const runningTime = now.getTime() + 1 - startedAt.getTime();
      return timeout - runningTime;
    }

    function resolveDuration() {
      if (state && state.hasOwnProperty('timeout')) return state.timeout;
      return iso8601duration.toSeconds(iso8601duration.parse(isoDuration)) * 1000;
    }
  }
};
