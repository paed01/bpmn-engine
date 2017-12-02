'use strict';

const debug = require('debug')('bpmn-engine:definition');

module.exports = DefinitionExecution;

function DefinitionExecution(definition) {
  const {id, type, environment, entryPointId, contextHelper, warnings} = definition;
  const emit = (...args) => definition.emit(...args);
  const processes = definition.getProcesses();
  const mainProcess = processes.find(p => p.id === entryPointId);

  let complete, entered, started, stopped;
  const completed = [], running = [];

  const executionApi = {
    id,
    type,
    getChildState,
    getState,
    getPendingActivities,
    execute,
    processes,
    resume,
    signal,
    stop
  };

  return executionApi;

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

    return executionApi;
  }

  function resume(state, callback) {
    complete = completeCallback(callback);
    if (warnings.length) return complete(warnings[0]);
    if (!processes.length) return complete();

    setup();

    processes.forEach((p) => {
      p.resume(state.processes[p.id]);
    });

    return executionApi;
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
      emit('end', definition, executionApi);
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

  function getChildState(childId) {
    for (let i = 0; i < running.length; ++i) {
      const state = running[i].getChildState(childId);
      if (state) return state;
    }
    for (let i = 0; i < completed.length; ++i) {
      const state = completed[i].getChildState(childId);
      if (state) return state;
    }
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
    if (!entered) emit('enter', definition, executionApi);
    entered = true;
  }

  function onStart() {
    if (!started) emit('start', definition, executionApi);
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
      environment.assignResult(processExecution.getOutput());
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
