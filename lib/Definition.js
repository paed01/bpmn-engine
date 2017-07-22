'use strict';

const ContextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:definition');
const EventEmitter = require('events').EventEmitter;
const Process = require('./activities/Process');
const validation = require('./validation');
const Environment = require('./Environment');

function Definition(moddleContext, options) {
  if (!moddleContext) throw new Error('No moddle context');
  options = options || {};
  return DefinitionInstance(moddleContext, options);
}

module.exports = Definition;

Definition.resume = function(state, optionsOrCallback, callback) {
  let options = {};
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
  } else if (optionsOrCallback) {
    options = optionsOrCallback;
  }

  const instance = DefinitionInstance(state.moddleContext, state.environment);
  setImmediate(instance.resume, state, options, callback);
  return instance;
};

function DefinitionInstance(moddleContext, options) {
  if (!moddleContext) throw new Error('No moddle context');
  options = options || {};
  validation.validateOptions(options);

  const warnings = validation.validateModdleContext(moddleContext);

  const contextHelper = ContextHelper(moddleContext);
  const processElements = contextHelper.getProcesses();
  const entryPointId = contextHelper.getExecutableProcessId();

  const id = contextHelper.getDefinitionId() || 'anonymous';
  const type = 'bpmn:Definition';

  let environment = Environment(options);
  let definitionExecution, mainProcess, processes;

  loadProcesses(environment);

  const definitionApi = Object.assign(new EventEmitter(), {
    id,
    type,
    contextHelper,
    entryPointId,
    warnings,
    environment,
    getState,
    moddleContext,
    getChildActivityById,
    getPendingActivities,
    getProcesses,
    getProcessById,
    resume,
    execute,
    signal,
    stop
  });

  return definitionApi;

  function execute(optionsOrCallback, callback) {
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback;
    } else if (optionsOrCallback) {
      validation.validateOptions(optionsOrCallback);
      environment = Environment(optionsOrCallback);
      definitionApi.environment = environment;
      loadProcesses(environment);
    }

    definitionExecution = DefinitionExecution(definitionApi);
    definitionExecution.execute(callback);

    return definitionExecution;
  }

  function resume(state, optionsOrCallback, callback) {
    debug(`<${id}> resume`);
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback;
    } else if (optionsOrCallback) {
      if (optionsOrCallback.listener) {
        environment.setListener(optionsOrCallback.listener);
      }
    }

    definitionExecution = DefinitionExecution(definitionApi);
    definitionExecution.resume(state, callback);

    return definitionExecution;
  }

  function stop() {
    if (definitionExecution) return definitionExecution.stop();
  }

  function getState() {
    const result = {
      id,
      type,
      state: 'pending',
      moddleContext: contextHelper.clone(),
      environment: environment.getState()
    };

    if (definitionExecution) Object.assign(result, definitionExecution.getState());

    return result;
  }

  function signal(...args) {
    if (definitionExecution) return definitionExecution.signal(...args);
  }

  function getProcesses(callback) {
    if (warnings.length) {
      if (callback) return callback(warnings[0]);
    }

    mainProcess = processes.find((p) => p.id === entryPointId);
    if (callback) callback(null, mainProcess, processes);
    return processes;
  }

  function loadProcesses(env) {
    processes = processElements.map((element) => new Process(element, moddleContext, env));
    debug(`<${id}> found ${processes.length} processes`);
  }

  function getProcessById(processId) {
    return processes.find((p) => p.id === processId);
  }

  function getChildActivityById(childId) {
    let child;
    const siblings = getProcesses();
    for (let i = 0; i < siblings.length; i++) {
      child = siblings[i].getChildActivityById(childId);
      if (child) return child;
    }
    return child;
  }

  function getPendingActivities() {
    if (!definitionExecution) {
      return {
        state: 'pending',
        children: []
      };
    }
    return definitionExecution.getPendingActivities();
  }
}

function DefinitionExecution(definition) {
  const id = definition.id;
  const type = definition.type;
  const emit = definition.emit.bind(definition);
  const entryPointId = definition.entryPointId;
  const contextHelper = definition.contextHelper;
  const processes = definition.getProcesses();
  const mainProcess = processes.find(p => p.id === entryPointId);
  const warnings = definition.warnings;

  let complete, entered, started, stopped;
  const completed = [], running = [];

  const activityApi = {
    id,
    type,
    getState,
    getPendingActivities,
    execute,
    processes,
    resume,
    signal,
    stop
  };

  return activityApi;

  function execute(callback) {
    complete = completeCallback(callback);
    if (warnings.length) return complete(warnings[0]);

    if (!processes.length) return complete();
    if (!entryPointId) {
      return complete(new Error(`definition <${id}> has no executable process`));
    }

    setup();

    debug(`<${id}> start with <${entryPointId}>`);
    mainProcess.run();

    return activityApi;
  }

  function resume(state, callback) {
    complete = completeCallback(callback);
    if (warnings.length) return complete(warnings[0]);
    if (!processes.length) return complete();

    setup();

    processes.forEach((p) => {
      p.resume(state.processes[p.id]);
    });

    return activityApi;
  }

  function completeCallback(callback) {
    return (err, ...args) => {
      debug(`<${id}> end`);
      teardown(processes);
      if (err) {
        if (callback) return callback(err, ...args);
        emit('error', err, ...args);
      }
      if (callback) callback(err, ...args);
      emit('end', activityApi);
    };
  }

  function getState() {
    const result = {
      state: getRunningStatus(),
      entryPointId,
      processes: {}
    };

    if (stopped) {
      result.stopped = true;
    }

    running.reduce((states, pe) => {
      const processState = pe.getState();
      states[processState.id] = processState;
      return states;
    }, result.processes);

    completed.reduce((states, pe) => {
      const processState = pe.getState();
      states[processState.id] = processState;
      return states;
    }, result.processes);

    return result;
  }

  function getRunningStatus() {
    if (!running.length && !completed.length) return 'pending';
    return running.length ? 'running' : 'completed';
  }

  function getPendingActivities() {
    const result = {
      state: getRunningStatus(),
    };

    result.children = running.reduce((list, pe) => {
      list = list.concat(pe.getPendingActivities());
      return list;
    }, []);

    return result;
  }

  function setup() {
    processes.forEach((p) => {
      p.on('enter', onEnter);
      p.on('start', onStart);
      p.on('message', onMessage);
      p.on('end', onEnd);
      p.on('error', onError);
    });
  }

  function teardown() {
    processes.forEach((p) => {
      p.removeListener('enter', onEnter);
      p.removeListener('start', onStart);
      p.removeListener('message', onMessage);
      p.removeListener('end', onEnd);
      p.removeListener('error', onError);
    });
  }

  function onEnter(processApi, processExecution) {
    debug(`<${id}> entering <${processExecution.id}>`);

    running.push(processExecution);
    if (!entered) emit('enter', activityApi);
    entered = true;
  }

  function onStart() {
    if (!started) emit('start', activityApi);
    started = true;
  }

  function onMessage(message) {
    const via = message.via;
    const targetElement = contextHelper.getTargetProcess(via.targetId);

    debug(`<${id}> message sent from <${via.sourceId}> via <${via.id}> to <${targetElement.id}>`);

    const runningIndex = getRunningIndexById(targetElement.id);

    const targetProcess = definition.getProcessById(targetElement.id);
    if (runningIndex === -1) {
      debug(`<${id}> spinning up <${targetElement.id}>`);

      targetProcess.run();
      return setImmediate(sendMessage, targetElement.id, message);
    }

    sendMessage(targetElement.id, message);
  }

  function onEnd(processApi, processExecution) {
    const runningIndex = running.findIndex((p) => p === processExecution);
    if (runningIndex > -1) {
      debug(`<${id}> completed <${processExecution.id}>`);
      completed.push(running[runningIndex]);
      running.splice(runningIndex, 1);
    }

    if (!running.length) {
      complete();
    }
  }

  function onError(error, ...args) {
    teardown(processes);
    complete(error, ...args);
  }

  function sendMessage(targetProcessId, message) {
    const runningIndex = getRunningIndexById(targetProcessId);
    running[runningIndex].sendMessage(message);
  }

  function getRunningIndexById(processId) {
    return running.findIndex((p) => p.id === processId);
  }

  function signal(...args) {
    for (let i = 0; i < running.length; ++i) {
      if (running[i].signal(...args)) return true;
    }
  }

  function stop() {
    debug(`<${id}> stop`);
    stopped = true;
    running.forEach((pe) => pe.stop());
    complete();
  }
}
