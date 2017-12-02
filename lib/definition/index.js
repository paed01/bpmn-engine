'use strict';

const ContextHelper = require('../context-helper');
const DefinitionExecution = require('./Execution');
const debug = require('debug')('bpmn-engine:definition');
const Environment = require('../Environment');
const getOptionsAndCallback = require('../getOptionsAndCallback');
const Process = require('../process');
const validation = require('../validation');
const {EventEmitter} = require('events');

function Definition(moddleContext, options) {
  options = options || {};
  return DefinitionInstance(moddleContext, options);
}

module.exports = Definition;

Definition.waken = waken;
Definition.resume = function(state, resumeOptions, resumeCallback) {
  const [options, callback] = getOptionsAndCallback(resumeOptions, resumeCallback);
  const instance = waken(state, options);
  setImmediate(instance.resume, state, options, callback);
  return instance;
};

function waken(state, resumeOptions) {
  const environment = Environment(resumeOptions).resume(state.environment);
  return DefinitionInstance(state.moddleContext, null, environment);
}

function DefinitionInstance(moddleContext, options, environment) {
  if (!moddleContext) throw new Error('No moddle context');
  options = options || {};
  validation.validateOptions(options);
  environment = environment || Environment(options);

  const warnings = validation.validateModdleContext(moddleContext);

  const contextHelper = ContextHelper(moddleContext);
  const processElements = contextHelper.getProcesses();
  const entryPointId = contextHelper.getExecutableProcessId();

  const id = contextHelper.getDefinitionId() || 'anonymous';
  const type = 'bpmn:Definition';

  let definitionExecution, mainProcess, processes;

  const definitionApi = Object.assign(new EventEmitter(), {
    id,
    type,
    contextHelper,
    entryPointId,
    warnings,
    environment,
    execute,
    getChildState,
    getState,
    getOutput,
    moddleContext,
    getChildActivityById,
    getPendingActivities,
    getProcesses,
    getProcessById,
    resume,
    signal,
    stop
  });

  function emit(...args) {
    definitionApi.emit(...args);
  }

  return definitionApi;

  function execute(executeOptionsOrCallback, executeCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(executeOptionsOrCallback, executeCallback);

    if (executeOptions) {
      validation.validateOptions(executeOptions);
      definitionApi.environment = environment = Environment(executeOptions);
      loadProcesses(environment);
    }

    definitionExecution = DefinitionExecution(definitionApi);
    definitionExecution.execute(callback);

    return definitionExecution;
  }

  function resume(state, resumeOptions, resumeCallback) {
    debug(`<${id}> resume`);
    const [executeOptions, callback] = getOptionsAndCallback(resumeOptions, resumeCallback);

    if (warnings.length) {
      if (!callback) return emit('error', warnings[0]);
      return callback(warnings[0]);
    }

    definitionApi.environment = environment = environment.resume(state.environment);
    if (executeOptions && executeOptions.listener) {
      environment.setListener(executeOptions.listener);
    }

    resumeProcesses(environment, state);
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

  function getChildState(childId) {
    if (definitionExecution) return definitionExecution.getChildState(childId);
  }

  function getOutput() {
    return environment.getOutput();
  }

  function signal(...args) {
    if (definitionExecution) return definitionExecution.signal(...args);
  }

  function getProcesses(callback) {
    if (warnings.length) {
      if (callback) return callback(warnings[0]);
    }

    if (!processes) loadProcesses(environment);

    mainProcess = processes.find((p) => p.id === entryPointId);
    if (callback) callback(null, mainProcess, processes);
    return processes;
  }

  function loadProcesses() {
    processes = processElements.map((element) => Process(element, moddleContext, environment));
    debug(`<${id}> found ${processes.length} processes`);
  }

  function resumeProcesses(env, state) {
    processes = [];

    processElements.forEach((element) => {
      const processState = state.processes[element.id];
      if (processState) {
        processes.push(Process.setState(processState, moddleContext, env));
      } else {
        processes.push(Process(element, moddleContext, env));
      }
    });

    debug(`<${id}> resumed ${processes.length} processes`);
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
