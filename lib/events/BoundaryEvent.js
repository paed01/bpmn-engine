'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');
const mapper = require('../mapper');

function BoundaryEvent(activity) {
  Object.assign(this, activity);
  this.isStart = false;
  this.cancelActivity = activity.getEventDefinitions().some(({cancelActivity}) => cancelActivity);
}

BoundaryEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = BoundaryEvent;

BoundaryEvent.prototype.run = function(message) {
  return this.activate().run(message);
};

BoundaryEvent.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const environment = scope.environment;
  const attachedTo = scope.getAttachedToActivity();
  const eventDefinitions = scope.getEventDefinitions();
  const inbound = scope.inbound;
  const outbound = scope.outbound;
  const pendingDefinitionExecutions = [];

  let attachedListener, events;

  state = Object.assign(state || {}, {
    id,
    type,
    attachedToId: attachedTo.id
  });

  const activityApi = {
    id,
    type,
    inbound,
    outbound,
    attachedTo,
    deactivate,
    getApi,
    getEvents,
    getState,
    run,
    resume,
    stop
  };

  activate();

  return activityApi;

  function run(attachedApi, attachedExecution) {
    attachedListener = AttachedListener(attachedApi, attachedExecution);
  }

  function activate() {
    attachedTo.on('enter', onAttachedEnter);
  }

  function deactivate() {
    attachedTo.removeListener('enter', onAttachedEnter);
    stopAttachedListener();
  }

  function stopAttachedListener() {
    if (!attachedListener) return;
    attachedListener.unattach();
    attachedListener = null;
  }

  function onAttachedEnter(...args) {
    run(...args);
  }

  function stop() {
    deactivate();
  }

  function resume() {}

  function complete(executionContext) {
    delete state.entered;
    state.taken = true;
    takeAllOutbound(executionContext);
  }

  function getState() {
    const result = Object.assign({}, state);
    return result;
  }

  function getEvents() {
    if (events) return events.slice();

    events = eventDefinitions.map((eventDefinition) => {
      eventDefinition.id = eventDefinition.id || id;
      return mapper(eventDefinition.type)(eventDefinition, state, attachedTo);
    });

    return events.slice();
  }

  function takeAllOutbound(executionContext) {
    stopAttachedListener();
    emit('end', activityApi, executionContext);
    debug(`<${id}> take all outbound (${outbound.length})`);
    if (outbound) outbound.forEach((flow) => flow.take());
    asyncEmit('leave', activityApi, executionContext);
  }

  function discardAllOutbound(rootFlow, executionContext) {
    stopAttachedListener();
    delete state.entered;
    emit('leave', activityApi, executionContext);
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }

  function AttachedListener(attachedApi, attachedExecution) {
    let attached = false;
    const executionContext = ActivityExecution(activityApi, null, environment);
    const eventDefinitionActivities = activateEventDefinitions();

    enter();
    attach();

    return {
      executionContext,
      unattach
    };

    function activateEventDefinitions() {
      const definitionActivities = getEvents().map((ed) => ed.activate(activityApi, executionContext, definitionEmitter));
      return definitionActivities;

      function definitionEmitter(eventName, ...args) {
        switch (eventName) {
          case 'enter':
            onDefinitionEnter(...args);
            break;
          case 'start':
            onDefinitionStart(...args);
            break;
          case 'catch':
            onDefinitionCatch(...args);
            break;
          case 'leave':
            onDefinitionLeave(...args);
            break;
        }
      }

      function onDefinitionEnter(definitionApi) {
        pendingDefinitionExecutions.push(definitionApi);
      }

      function onDefinitionStart() {
        emit('start', activityApi, executionContext);
      }

      function onDefinitionCatch(error) {
        emit('catch', error, activityApi, executionContext);
      }

      function onDefinitionLeave(definitionApi) {
        const idx = pendingDefinitionExecutions.indexOf(definitionApi);
        if (idx < 0) return completeCallback(new Error(`<${id}> ${definitionApi.type} is not running`));
        pendingDefinitionExecutions.splice(idx, 1);

        if (definitionApi.cancelActivity) return completeCallback(null, true);

        if (pendingDefinitionExecutions.length === 0) {
          return completeCallback();
        }
      }
    }

    function enter() {
      delete state.taken;
      state.entered = true;
      debug(`<${id}> enter`);
      emit('enter', activityApi, executionContext);
    }

    function attach() {
      if (attached) return;
      attached = true;
      attachedTo.once('start', onAttachedStart);
      attachedTo.on('cancel', onAttachedLeave);
      attachedTo.on('leave', onAttachedLeave);
    }

    function unattach() {
      if (!attached) return;
      Object.assign(state, executionContext.getState());
      attached = false;
      attachedTo.removeListener('start', onAttachedStart);
      attachedTo.removeListener('cancel', onAttachedLeave);
      attachedTo.removeListener('leave', onAttachedLeave);
      executionContext.stop();
    }

    function onAttachedStart(startApi) {
      attachedApi = startApi;
      executeAllDefinitions(executionContext);
    }

    function onAttachedLeave() {
      unattach();
      discardAllOutbound(attachedExecution.rootFlow, executionContext);
    }

    function executeAllDefinitions() {
      eventDefinitionActivities.forEach(({execute}) => execute());
    }

    function completeCallback(err, cancelActivity) {
      unattach();
      if (err) return emit('error', err, scope);
      state.taken = true;
      debug(`<${id}> completed`);
      if (cancelActivity) {
        debug(`<${id}> discarding ${attachedApi.type} <${attachedApi.id}>`);
        attachedApi.getApi(attachedExecution).discard();
      }
      complete(executionContext);
    }
  }

  function getApi(executionContext) {
    return Api(executionContext);

    function Api() {
      const api = {
        id,
        type,
        form: executionContext.form,
        cancel,
        discard,
        getInput: executionContext.getInput,
        getState: getExecutingState,
        stop
      };
      if (executionContext.signal) {
        api.signal = executionContext.signal;
      }

      return api;

      function getExecutingState() {
        return Object.assign(executionContext.getState(), getState());
      }

      function cancel() {
        state.canceled = true;
        emit('cancel', activityApi, executionContext);
        takeAllOutbound(executionContext);
      }

      function discard() {
        discardAllOutbound(executionContext);
      }
    }
  }
};
