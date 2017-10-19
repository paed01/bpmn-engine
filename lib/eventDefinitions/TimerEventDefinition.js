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

      const remaining = timer ? timeout : getRemainingMs();
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

// module.exports = function TimerEventDefinition(activityElement, eventDefinition, parentContext) {
//   const {id, $type: type, cancelActivity, timeDuration} = eventDefinition;
//   const duration = timeDuration && timeDuration.body;
//   const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

//   const definitionState = Object.assign({
//     id,
//     type
//   });

//   const definitionApi = {
//     id,
//     type,
//     duration,
//     cancelActivity,
//     activate
//   };

//   return definitionApi;

//   function activate(parentApi, parentExecutionContext, emit) {
//     let deactivated, startedAt, stoppedAt, timer;

//     const isoDuration = parentExecutionContext.resolveExpression(duration);
//     const timeout = resolveDuration();

//     definitionState.timeout = timeout;

//     const activityApi = {
//       type,
//       cancelActivity,
//       deactivate,
//       getState,
//       execute,
//       stop
//     };

//     parentExecutionContext.addStateSource(getState);
//     parentExecutionContext.addStopFn(stop);

//     emit('enter', activityApi, parentExecutionContext);

//     debug(`<${id}> run for duration ${timeout}ms`);

//     return activityApi;

//     function execute() {
//       if (deactivated) return;

//       startedAt = new Date();

//       definitionState.entered = true;
//       definitionState.startedAt = startedAt;

//       timer = setTimeout(() => {
//         timer = null;
//         stoppedAt = new Date();
//         debug(`<${id}> timed out`);
//         complete();
//       }, timeout);

//       emit('start', activityApi, parentExecutionContext);
//     }

//     function complete() {
//       deactivate();
//       emit('leave', activityApi, parentExecutionContext);
//     }

//     function stop() {
//       deactivate();
//       stoppedAt = stoppedAt || new Date();
//     }

//     function deactivate() {
//       deactivated = true;
//       if (timer) {
//         debug(`<${id}> stop timer`);
//         clearTimeout(timer);
//       }
//       timer = null;
//       definitionState.entered = undefined;
//     }

//     function getState() {
//       const remaining = getRemainingMs();

//       const result = {
//         timeout: remaining,
//         duration: timeout
//       };

//       if (startedAt) {
//         result.startedAt = startedAt;
//       }
//       if (stoppedAt) {
//         result.stoppedAt = stoppedAt;
//       }
//       return result;
//     }

//     function getRemainingMs() {
//       if (!startedAt) return timeout;
//       const now = stoppedAt || new Date();

//       const runningTime = now.getTime() - startedAt.getTime();
//       return timeout - runningTime;
//     }

//     function resolveDuration() {
//       // if (state && state.hasOwnProperty('timeout')) return state.timeout;
//       return iso8601duration.toSeconds(iso8601duration.parse(isoDuration)) * 1000;
//     }
//   }
// };
