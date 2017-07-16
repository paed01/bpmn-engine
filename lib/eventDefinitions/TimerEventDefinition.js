'use strict';

const Debug = require('debug');
const iso8601duration = require('iso8601-duration');

module.exports = function TimerEventDefinition(eventDefinition, state) {
  const id = eventDefinition.id;
  const type = eventDefinition.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const duration = eventDefinition.timeDuration;
  const cancelActivity = eventDefinition.cancelActivity;
  const definitionState = Object.assign({
    id,
    type
  }, state);

  const definitionApi = {
    id,
    type,
    duration,
    cancelActivity,
    activate
  };

  return definitionApi;

  function activate(parentApi, parentExecutionContext, emit) {
    let deactivated, startedAt, stoppedAt, timer;

    const isoDuration = parentExecutionContext.environment.resolveExpression(duration);
    const timeout = resolveDuration();

    definitionState.timeout = timeout;

    const activityApi = {
      type,
      cancelActivity,
      deactivate,
      getState,
      execute,
      stop
    };

    parentExecutionContext.addStateSource(getState);
    parentExecutionContext.addStopFn(stop);

    emit('enter', activityApi, parentExecutionContext);

    debug(`<${id}> run for duration ${timeout}ms`);

    return activityApi;

    function execute() {
      if (deactivated) return;

      startedAt = new Date();

      definitionState.entered = true;
      definitionState.startedAt = startedAt;

      timer = setTimeout(() => {
        timer = null;
        stoppedAt = new Date();
        debug(`<${id}> timed out`);
        complete();
      }, timeout);

      emit('start', activityApi, parentExecutionContext);
    }

    function complete() {
      deactivate();
      emit('leave', activityApi, parentExecutionContext);
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
      delete definitionState.entered;
    }

    function getState() {
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

      const runningTime = now.getTime() - startedAt.getTime();
      return timeout - runningTime;
    }

    function resolveDuration() {
      if (state && state.hasOwnProperty('timeout')) return state.timeout;
      return iso8601duration.toSeconds(iso8601duration.parse(isoDuration)) * 1000;
    }
  }
};
