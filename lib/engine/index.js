'use strict';

const debug = require('debug')('bpmn-engine:engine');
const Definition = require('../definition');
const Execution = require('./Execution');
const getOptionsAndCallback = require('../getOptionsAndCallback');
const validation = require('../validation');
const {EventEmitter} = require('events');
const {Source, transformSources} = require('./sources');
const {version: engineVersion} = require('../../package.json');

const validOptions = ['name', 'source', 'moddleContext', 'moddleOptions', 'extensions'];

function Engine(options) {
  return EngineInstance(options);
}

module.exports = Engine;

Engine.resurrect = function resurrectEngine(state, resurrectOptions) {
  let extensions, name = state.name;
  if (resurrectOptions) {
    extensions = resurrectOptions.extensions;
    name = resurrectOptions.name || name;
    validation.validateOptions(resurrectOptions);
  }

  if (state.definitions && !Array.isArray(state.definitions)) {
    throw new Error('State definitions must be an array');
  }

  return EngineInstance({name, extensions}).resurrect(state);
};

Engine.resume = function resumeExecution(state, resumeOptions, resumeCallback) {
  const [executeOptions, callback] = getOptionsAndCallback(resumeOptions, resumeCallback);

  let extensions, name = state.name;
  if (executeOptions) {
    extensions = executeOptions.extensions;
    name = executeOptions.name || name;
    validation.validateOptions(executeOptions);
  }

  if (state.definitions && !Array.isArray(state.definitions)) {
    const stateErr = new Error('State definitions must be an array');
    if (callback) return callback(stateErr);
    throw stateErr;
  }

  const instance = EngineInstance({name, extensions});
  instance.resume(state, executeOptions, callback);
  return instance;
};

function EngineInstance(options) {
  options = options || {};
  Object.keys(options).forEach((key) => {
    if (validOptions.indexOf(key) === -1) throw new Error(`Option ${key} is unsupported`);
  });

  const name = options.name || 'undefined';
  const moddleOptions = options.moddleOptions || {};
  const extensions = options.extensions;

  const definitions = [], moddleContexts = [], running = [], sources = [];

  if (extensions) {
    for (const extensionName in extensions) {
      const extension = extensions[extensionName];
      if (extension.moddleOptions) {
        debug(`adding ${extensionName} moddle options`);
        moddleOptions[extensionName] = extension.moddleOptions;
      }
    }
  }

  if (options.source) {
    if (!addDefinitionBySource(options.source)) {
      throw new Error('Unparsable Bpmn source');
    }
  }
  if (options.moddleContext) {
    if (!addDefinitionByModdleContext(options.moddleContext)) {
      throw new Error('Unparsable Bpmn source');
    }
  }

  const engineApi = Object.assign(new EventEmitter(), {
    name,
    type: 'engine',
    definitions,
    extensions,
    running,
    moddleContexts,
    moddleOptions,
    sources,
    addDefinitionByModdleContext,
    addDefinitionBySource,
    getDefinition,
    getDefinitionById,
    getDefinitions,
    getState,
    getPendingActivities,
    resurrect,
    resume,
    execute,
    signal,
    stop
  });

  const emit = (...args) => engineApi.emit(...args);

  return engineApi;

  function execute(executeOptionsOrCallback, executeCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(executeOptionsOrCallback, executeCallback, {extensions});
    validation.validateOptions(executeOptions);

    const execution = Execution(engineApi, emitter, executeOptions);
    running.push(execution);

    process.nextTick(execution.execute, callback);

    return execution;
  }

  function resurrect(state, resurrectOptions) {
    debug(`<${name}> resurrect ${state.definitions.length} definitions`);
    state.definitions.forEach(({moddleContext}) => addDefinitionByModdleContext(moddleContext));

    const resurrectedDefinitions = state.definitions.map((defState) => {
      return Definition.resurrect(defState, resurrectOptions);
    });
    definitions.push(...resurrectedDefinitions);

    const execution = Execution(engineApi, emitter, resurrectOptions);
    execution.resurrect(state, resurrectOptions);
    return engineApi;
  }

  function resume(state, resumeOptions, resumeCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(resumeOptions, resumeCallback, {extensions});

    debug(`<${name}> resume`);
    state.definitions.forEach(({moddleContext}) => addDefinitionByModdleContext(moddleContext));

    const execution = Execution(engineApi, emitter, executeOptions);
    running.push(execution);
    process.nextTick(execution.resume, state, callback);
    return execution;
  }

  function emitter(eventName, execution, ...args) {
    if (eventName === 'error') {
      return emit('error', ...args);
    }
    emit(eventName, execution, ...args);
    if (eventName === 'end') {
      completeExecution(execution);
    }
  }

  function getDefinition(callback) {
    getDefinitions((err, loadedDefs) => {
      if (err) return callback(err);
      return callback(null, loadedDefs[0]);
    });
  }

  function getDefinitionById(definitionId) {
    if (!running.length) {
      return definitions.find((def) => def.id === definitionId);
    }

    for (let i = 0; i < running.length; ++i) {
      const runningDef = running[i].getDefinitionById(definitionId);
      if (runningDef) return runningDef;
    }
  }

  function getDefinitions(executeOptionsOrCallback, getCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(executeOptionsOrCallback, getCallback, {extensions});

    if (definitions.length && !executeOptionsOrCallback) return callback(null, definitions);

    return transformSources(sources, (err) => {
      if (err) return callback(err);
      setDefinitionsFromSources(executeOptions);
      callback(null, definitions);
    });
  }

  function setDefinitionsFromSources(executeOptions) {
    if (definitions.length) definitions.splice();
    const ids = [];

    sources.forEach(({getTransformedDefinition}) => {
      const def = getTransformedDefinition(executeOptions);
      if (ids.includes(def.id)) return;
      ids.push(def.id);
      definitions.push(def);
    });
  }

  function addDefinitionBySource(sourceXml, sourceExtensions) {
    sourceExtensions = sourceExtensions || extensions;

    let sourceString;

    if (Buffer.isBuffer(sourceXml)) {
      sourceString = sourceXml.toString();
    } else if (typeof sourceXml === 'string') {
      sourceString = sourceXml;
    } else {
      return false;
    }

    const source = Source(sourceString, sourceExtensions);
    sources.push(source);

    return true;
  }

  function addDefinitionByModdleContext(moddleContext) {
    const source = Source(null, extensions);
    source.set(moddleContext);
    sources.push(source);
    moddleContexts.push(moddleContext);
    return true;
  }

  function getState() {
    const state = {
      name,
      engineVersion,
      extensions: extensions && Object.keys(extensions),
      state: running.length ? 'running' : 'idle',
      definitions: []
    };

    running.forEach((execution) => {
      state.definitions = state.definitions.concat(execution.getState().definitions);
    });

    return state;
  }

  function getPendingActivities() {
    const result = {
      state: running.length ? 'running' : 'idle',
      definitions: []
    };

    running.forEach((execution) => {
      result.definitions = result.definitions.concat(execution.getPendingActivities());
    });

    return result;
  }

  function signal(childId, message) {
    for (let i = 0; i < running.length; i++) {
      if (running[i].signal(childId, message)) return;
    }
  }

  function stop() {
    running.forEach((execution) => execution.stop());
  }

  function completeExecution(execution) {
    const runningIndex = running.findIndex((p) => p === execution);
    if (runningIndex > -1) {
      running.splice(runningIndex, 1);
    }
  }
}

