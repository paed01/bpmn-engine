'use strict';

const Debug = require('debug');
const {toSeconds, parse} = require('iso8601-duration');

module.exports = function TimerEventDefinition(activityElement, eventDefinition) {
  const {id: activityId} = activityElement;
  let {id} = eventDefinition;
  if (!id) id = activityId;
  const {$type: type, timeDuration} = eventDefinition;
  const durationDeclaration = timeDuration && timeDuration.body;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  debug(`<${id}> loaded`);

  return {
    id,
    type,
    duration: durationDeclaration,
    activate,
    resume: resumeActivity,
  };

  function resumeActivity(state, parentApi, activityExecution, emit) {
    const resumed = activate(parentApi, activityExecution, emit);
    resumed.resume(state);
    return resumed;
  }

  function activate(parentApi, activityExecution, emit) {
    const isoDuration = activityExecution.resolveExpression(durationDeclaration);
    let completeState, duration, startedAt, stoppedAt, timer;
    let timeout = duration = isoToMs(isoDuration);

    return {
      id,
      type,
      execute,
      getState,
      onStart,
      onEnter,
      onMessage,
      onEnd,
      onCancel,
      onLeave,
      onError,
      resume,
      stop
    };

    function getState() {
      if (completeState) return completeState;

      const remaining = getRemainingMs();
      const result = {
        timeout: remaining,
        duration
      };

      if (startedAt) {
        result.startedAt = startedAt;
      }
      if (stoppedAt) {
        result.stoppedAt = stoppedAt;
      }

      return result;
    }

    function resume(state) {
      duration = state.duration;
      timeout = state.timeout;
    }

    function stop() {
      if (timer) {
        debug(`<${id}> stop timer`);
        clearTimeout(timer);
      }
      timer = null;
    }

    function execute() {
      onStart();
    }

    function onEnter() {}

    function onStart() {
      startedAt = new Date();
      debug(`<${id}> initiate for duration ${isoDuration}`);

      timer = setTimeout(complete, timeout);

      emit('start', parentApi, activityExecution);
      emit('wait', parentApi, activityExecution);
    }

    function onLeave() {}
    function onEnd() {}
    function onMessage() {}
    function onCancel() {}
    function onError() {
      stop();
    }

    function getRemainingMs() {
      if (!startedAt) return timeout;
      const now = stoppedAt || new Date();

      const runningTime = now.getTime() - startedAt.getTime();
      return timeout - runningTime;
    }

    function complete() {
      timer = null;
      stoppedAt = new Date();
      debug(`<${id}> timed out`);
      completeState = getState();
      completeState.timeout = undefined;

      emit('end', parentApi, activityExecution);
    }
  }

  function isoToMs(isoDuration) {
    return toSeconds(parse(isoDuration)) * 1000;
  }
};
