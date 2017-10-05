'use strict';

const ActivityExecution = require('../activities/activity-execution');
const ActivityIO = require('../io/ActivityIO');
const Debug = require('debug');
const EventDefinition = require('../eventDefinitions/EventDefinition');
const {EventEmitter} = require('events');

module.exports = function BoundaryEvent(activityElement, parentContext) {
  const {id, $type: type, eventDefinitions} = activityElement;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  const {environment, getOutboundSequenceFlows, getAttachedToActivity} = parentContext;
  let attachedTo;
  const outbound = getOutboundSequenceFlows(id);
  const io = ActivityIO(activityElement, parentContext);

  let loadedEventDefinitions, attachedToListener, resumedState;

  const activityApi = Object.assign(new EventEmitter(), {
    id,
    type,
    io,
    outbound,
    getApi,
    getState,
    getEventDefinitions,
    activate: activateActivity,
    deactivate: deactivateActivity,
    resume: resumeActivity,
    run,
  });

  function emit(...args) {
    activityApi.emit(...args);
  }

  return activityApi;

  function run() {

  }

  function stopActivity() {

  }

  function resumeActivity(state) {
    resumedState = state;
  }

  function getState() {
    const result = {
      id,
      type,
      attachedToId: getAttachedTo().id
    };

    if (attachedToListener) Object.assign(result, attachedToListener.getListenerState());

    return result;
  }

  function activateActivity() {
    if (attachedToListener) return attachedToListener;
    const attachedToActivity = getAttachedTo();
    attachedToActivity.on('enter', onAttachedToEnter);
    attachedToActivity.on('leave', onAttachedToLeave);
    return activityApi;
  }

  function deactivateActivity() {
    const attachedToActivity = getAttachedTo();
    attachedToActivity.removeListener('enter', onAttachedToEnter);
    attachedToActivity.removeListener('leave', onAttachedToLeave);
    if (attachedToListener) attachedToListener.stop();
  }

  function onAttachedToEnter(...args) {
    attachedToListener = AttachedToListener(...args);
    if (resumedState) {
      attachedToListener.resume(resumedState);
      resumedState = undefined;
    }
    attachedToListener.enter();
    return attachedToListener;
  }

  function onAttachedToLeave() {
    if (attachedToListener) {
      attachedToListener.complete();
      attachedToListener = undefined;
    }
  }

  function getEventDefinitions() {
    if (loadedEventDefinitions) return loadedEventDefinitions;

    if (!eventDefinitions) {
      loadedEventDefinitions = [];
    } else {
      loadedEventDefinitions = eventDefinitions.reduce((result, ed) => {
        const eventDefinition = EventDefinition(activityElement, ed, parentContext);
        if (eventDefinition) result.push(eventDefinition);
        return result;
      }, []);
    }

    return loadedEventDefinitions;
  }

  function getAttachedTo() {
    if (attachedTo) return attachedTo;
    attachedTo = getAttachedToActivity(id);
    return attachedTo;
  }

  function AttachedToListener(attachedToApi, attachedToExecution) {
    let activityExecution, activeDefinitions;
    const attachedToActivity = getAttachedTo();
    const {id: attachedToId} = attachedToActivity;
    let entered, taken;

    attachedToActivity.once('start', onAttachedStart);

    return {
      enter,
      resume,
      complete,
      deactivate,
      getListenerState,
      stop
    };

    function enter() {
      entered = true;
      debug(`<${id}> entered`);
      emit('enter', activityApi, getActivityExecution());
    }

    function resume(state) {
      resumeEventDefinitions(state);
    }

    function onAttachedStart(...args) {
      debug(`<${id}> listen to <${attachedToId}>`);

      activate();

      emit('start', activityApi, getActivityExecution());
      getActivateEventDefinitions().forEach((ed) => {
        ed.onStart(...args);
      });
    }

    function complete() {
      const execution = getActivityExecution();
      deactivate();
      entered = undefined;

      if (taken) {
        debug(`<${id}> take all outbound`);
        execution.takeAllOutbound();
        emit('end', activityApi, execution);
        return asyncEmit('leave', activityApi, execution);
      } else {
        debug(`<${id}> discard all outbound`);
        execution.discardAllOutbound();
        return emit('leave', activityApi, execution);
      }
    }

    function stop() {
      deactivate();
      if (activeDefinitions) activeDefinitions.forEach((ed) => ed.stop());
    }

    function activate() {
      attachedToActivity.prependListener('error', onAttachedError);
    }

    function deactivate() {
      attachedToActivity.removeListener('start', onAttachedStart);
      attachedToActivity.removeListener('error', onAttachedError);
    }

    function onAttachedError(err, ...args) {
      getActivateEventDefinitions().forEach((ed) => {
        if (ed.onError(err, ...args)) {
          discardAttachedTo();
        }
      });
    }

    function discardAttachedTo() {
      if (taken) return;

      debug(`<${id}> discard <${attachedToId}>`);
      taken = true;
      attachedToApi.getApi(attachedToExecution).discard();
      deactivate();
      emit('end', activityApi, getActivityExecution());
    }

    function getListenerState() {
      return getActivateEventDefinitions().reduce((result, ed) => {
        Object.assign(result, ed.getState());
        return result;
      }, {
        entered,
        taken
      });
    }

    function getActivityExecution() {
      if (activityExecution) return activityExecution;
      activityExecution = ActivityExecution(activityApi, null, environment);
      return activityExecution;
    }

    function getActivateEventDefinitions() {
      if (activeDefinitions) return activeDefinitions;
      activeDefinitions = getEventDefinitions().map((ed) => ed.activate(activityApi, getActivityExecution(), emit));
      return activeDefinitions;
    }

    function resumeEventDefinitions(state) {
      if (activeDefinitions) return activeDefinitions;
      activeDefinitions = getEventDefinitions().map((ed) => ed.resume(state, activityApi, getActivityExecution(), emit));
      return activeDefinitions;
    }
  }

  function getApi(activityExecution) {
    return Api();

    function Api() {
      const api = {
        id,
        type,
        form: activityExecution.form,
        cancel,
        discard,
        getInput: activityExecution.getInput,
        getOutput: activityExecution.getOutput,
        getState: getExecutingState,
        stop: stopActivity
      };
      if (activityExecution.signal) {
        api.signal = activityExecution.signal;
      }

      return api;

      function getExecutingState() {
        return Object.assign(activityExecution.getState(), getState());
      }

      function cancel() {
        state.canceled = true;
        emit('cancel', activityApi, activityExecution);
        takeAllOutbound(activityExecution);
      }

      function discard() {
        discardAllOutbound(activityExecution);
      }
    }
  }

  function asyncEmit(eventName, ...args) {
    setImmediate(emit, eventName, ...args);
  }
};



// BoundaryEvent.prototype = Object.create(EventEmitter.prototype);

// module.exports = BoundaryEvent;

// BoundaryEvent.prototype.run = function(message) {
//   return this.activate().run(message);
// };

// BoundaryEvent.prototype.activate = function(state) {
//   const event = this;
//   const {id, type, environment, inbound, outbound} = event;
//   const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
//   const emit = (...args) => event.emit(...args);
//   const attachedTo = event.getAttachedToActivity();
//   const eventDefinitions = event.getEventDefinitions();
//   const pendingDefinitionExecutions = [];

//   let attachedListener;

//   state = Object.assign(state || {}, {
//     id,
//     type,
//     attachedToId: attachedTo.id
//   });

//   const activityApi = {
//     id,
//     type,
//     inbound,
//     outbound,
//     attachedTo,
//     deactivate,
//     getApi,
//     getEvents,
//     getState,
//     run,
//     resume,
//     stop
//   };

//   activate();

//   return activityApi;

//   function run(attachedApi, attachedExecution) {
//     attachedListener = AttachedListener(attachedApi, attachedExecution);
//   }

//   function activate() {
//     attachedTo.on('enter', onAttachedEnter);
//   }

//   function deactivate() {
//     attachedTo.removeListener('enter', onAttachedEnter);
//     stopAttachedListener();
//   }

//   function stopAttachedListener() {
//     if (!attachedListener) return;
//     attachedListener.unattach();
//     attachedListener = null;
//   }

//   function onAttachedEnter(...args) {
//     run(...args);
//   }

//   function stop() {
//     deactivate();
//   }

//   function resume(state) {
//     const loadedEvents = getEvents();

//     console.log('RESUME', state)
//   }

//   function complete(executionContext) {
//     state.entered = undefined;
//     state.taken = true;
//     takeAllOutbound(executionContext);
//   }

//   function getState() {
//     const result = Object.assign({}, state, attachedListener && attachedListener.getState());
//     return result;
//   }

//   function getEvents() {
//     if (eventDefinitions) return eventDefinitions.slice();
//   }

//   function takeAllOutbound(executionContext) {
//     stopAttachedListener();
//     emit('end', activityApi, executionContext);
//     debug(`<${id}> take all outbound (${outbound.length})`);
//     if (outbound) outbound.forEach((flow) => flow.take());
//     asyncEmit('leave', activityApi, executionContext);
//   }

//   function discardAllOutbound(rootFlow, executionContext) {
//     stopAttachedListener();
//     state.entered = undefined;
//     emit('leave', activityApi, executionContext);
//     if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
//   }

//   function asyncEmit(eventName, ...args) {
//     debug(`<${id}> async ${eventName}`);
//     setImmediate(emit, eventName, ...args);
//   }

//   function AttachedListener(attachedApi, attachedExecution) {
//     let attached = false;
//     const executionContext = ActivityExecution(event, null, environment);
//     const eventDefinitionActivities = activateEventDefinitions();

//     enter();
//     attach();

//     return {
//       executionContext,
//       getState: getAttachedState,
//       unattach
//     };

//     function activateEventDefinitions() {
//       const definitionActivities = getEvents().map((ed) => ed.activate(activityApi, executionContext, definitionEmitter));
//       return definitionActivities;

//       function definitionEmitter(eventName, ...args) {
//         switch (eventName) {
//           case 'enter':
//             onDefinitionEnter(...args);
//             break;
//           case 'start':
//             onDefinitionStart(...args);
//             break;
//           case 'catch':
//             onDefinitionCatch(...args);
//             break;
//           case 'leave':
//             onDefinitionLeave(...args);
//             break;
//         }
//       }

//       function onDefinitionEnter(definitionApi) {
//         pendingDefinitionExecutions.push(definitionApi);
//       }

//       function onDefinitionStart() {
//         emit('start', activityApi, executionContext);
//       }

//       function onDefinitionCatch(error) {
//         emit('catch', error, activityApi, executionContext);
//       }

//       function onDefinitionLeave(definitionApi) {
//         const idx = pendingDefinitionExecutions.indexOf(definitionApi);
//         if (idx < 0) return completeCallback(new Error(`<${id}> ${definitionApi.type} is not running`));
//         pendingDefinitionExecutions.splice(idx, 1);

//         if (definitionApi.cancelActivity) return completeCallback(null, true);

//         if (pendingDefinitionExecutions.length === 0) {
//           return completeCallback();
//         }
//       }
//     }

//     function getAttachedState() {
//       return eventDefinitionActivities.reduce((result, ed) => {
//       console.log('KJLADLKJASDKJKLJASD', ed.getState())
//         Object.assign(result, ed.getState());
//       }, {});
//     }

//     function enter() {
//       if (state.taken) state.taken = undefined;
//       state.entered = true;
//       debug(`<${id}> enter`);
//       emit('enter', activityApi, executionContext);
//     }

//     function attach() {
//       if (attached) return;
//       attached = true;
//       attachedTo.once('start', onAttachedStart);
//       attachedTo.on('error', onAttachedError);
//       attachedTo.on('cancel', onAttachedLeave);
//       attachedTo.on('leave', onAttachedLeave);
//     }

//     function unattach() {
//       if (!attached) return;
//       Object.assign(state, executionContext.getState());
//       attached = false;
//       attachedTo.removeListener('start', onAttachedStart);
//       attachedTo.removeListener('cancel', onAttachedLeave);
//       attachedTo.removeListener('leave', onAttachedLeave);
//       executionContext.stop();
//     }

//     function onAttachedStart(startApi) {
//       attachedApi = startApi;
//       eventDefinitionActivities.forEach(({onStart}) => onStart());
//       emit('start', activityApi, executionContext);
//       // executeAllDefinitions(executionContext);
//     }

//     function onAttachedError(err, ...args) {
//       eventDefinitionActivities.forEach(({onError}) => onError(err, ...args));
//       // executeAllDefinitions(executionContext);
//     }

//     function onAttachedLeave() {
//       unattach();
//       discardAllOutbound(attachedExecution.rootFlow, executionContext);
//     }

//     function executeAllDefinitions() {
//       eventDefinitionActivities.forEach(({execute}) => execute());
//     }

//     function completeCallback(err, cancelActivity) {
//       unattach();
//       if (err) return emit('error', err, event);
//       state.taken = true;
//       debug(`<${id}> completed`);
//       if (cancelActivity) {
//         debug(`<${id}> discarding ${attachedApi.type} <${attachedApi.id}>`);
//         attachedApi.getApi(attachedExecution).discard();
//       }
//       complete(executionContext);
//     }
//   }

//   function getApi(executionContext) {
//     return Api(executionContext);

//     function Api() {
//       const api = {
//         id,
//         type,
//         form: executionContext.form,
//         cancel,
//         discard,
//         getInput: executionContext.getInput,
//         getOutput: executionContext.getOutput,
//         getState: getExecutingState,
//         stop
//       };
//       if (executionContext.signal) {
//         api.signal = executionContext.signal;
//       }

//       return api;

//       function getExecutingState() {
//         return Object.assign(executionContext.getState(), getState());
//       }

//       function cancel() {
//         state.canceled = true;
//         emit('cancel', activityApi, executionContext);
//         takeAllOutbound(executionContext);
//       }

//       function discard() {
//         discardAllOutbound(executionContext);
//       }
//     }
//   }
// };
