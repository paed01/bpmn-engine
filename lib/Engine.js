'use strict';

const debug = require('debug')('bpmn-engine:engine');
const {EventEmitter} = require('events');
const Definition = require('./Definition');
const getOptionsAndCallback = require('./getOptionsAndCallback');
const getPropertyValue = require('./getPropertyValue');
const transformer = require('./transformer');
const validation = require('./validation');
const {version: engineVersion} = require('../package.json');

const validOptions = ['name', 'source', 'moddleContext', 'moddleOptions'];

function Engine(options) {
  return EngineInstance(options);
}

module.exports = Engine;

Engine.resume = function resumeExecution(state, resumeOptions, resumeCallback) {
  const [executeOptions, callback] = getOptionsAndCallback(resumeOptions, resumeCallback);

  if (executeOptions) {
    validation.validateOptions(executeOptions);
  }

  if (state.definitions && !Array.isArray(state.definitions)) {
    const stateErr = new Error('State definitions must be an array');
    if (callback) return callback(stateErr);
    throw stateErr;
  }

  const instance = EngineInstance();
  instance.resume(state, executeOptions, callback);
  return instance;
};

function EngineInstance(options) {
  options = options || {};
  Object.keys(options).forEach((key) => {
    if (validOptions.indexOf(key) === -1) throw new Error(`Option ${key} is unsupported`);
  });

  const name = options.name || 'undefined';
  const definitions = [], moddleContexts = [], running = [], sources = [];
  const moddleOptions = options.moddleOptions || {};

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
    resume,
    execute,
    signal,
    stop
  });

  const emit = (...args) => engineApi.emit(...args);

  return engineApi;

  function execute(executeOptionsOrCallback, executeCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(executeOptionsOrCallback, executeCallback);
    validation.validateOptions(executeOptions);

    const execution = Execution(engineApi, emitter, executeOptions);
    running.push(execution);

    process.nextTick(execution.execute, callback);

    return execution;
  }

  function resume(state, resumeOptions, resumeCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(resumeOptions, resumeCallback);

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
    const [executeOptions, callback] = getOptionsAndCallback(executeOptionsOrCallback, getCallback);

    if (definitions.length && !executeOptions) callback(null, definitions);

    transformSources(sources, (err) => {
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

  function addDefinitionBySource(sourceXml, sourceModdleOptions) {
    sourceModdleOptions = sourceModdleOptions || moddleOptions;

    let sourceString;

    if (Buffer.isBuffer(sourceXml)) {
      sourceString = sourceXml.toString();
    } else if (typeof sourceXml === 'string') {
      sourceString = sourceXml;
    } else {
      return false;
    }

    const source = Source(sourceString, sourceModdleOptions);
    sources.push(source);

    return true;
  }

  function addDefinitionByModdleContext(moddleContext) {
    const source = Source(null, moddleOptions);
    source.set(moddleContext);
    sources.push(source);
    moddleContexts.push(moddleContext);
    return true;
  }

  function getState() {
    const state = {
      name,
      engineVersion,
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

function Execution(engine, emit, executeOptions) {
  const sources = engine.sources.slice();
  const name = engine.name;
  const completed = [], definitions = [], running = [];

  let complete;

  const executionApi = {
    type: 'engine-execution',
    execute,
    getDefinitionById,
    getPendingActivities,
    getOutput,
    getState,
    resume,
    signal,
    stop
  };

  return executionApi;

  function execute(callback) {
    complete = completeCallback(callback);

    load((err) => {
      if (err) return complete(err);
      if (!definitions.length) return complete(new Error('Nothing to execute'));

      debug(`<${name}> executing ${definitions.length} definitions`);

      setup();

      definitions.forEach((def) => def.execute());
    });
  }

  function resume(state, callback) {
    const definitionStates = state.definitions;
    complete = completeCallback(callback);

    load((err) => {
      if (err) return complete(err);
      if (!definitions.length) return complete(new Error('Nothing to execute'));

      debug(`<${name}> resuming ${definitions.length} definitions`);

      setup();

      definitions.forEach((def, idx) => def.resume(definitionStates[idx], executeOptions));
    });
  }

  function stop() {
    running.forEach((definitionExecution) => definitionExecution.stop());
  }

  function getState() {
    return {
      definitions: definitions.map((def) => def.getState())
    };
  }

  function getOutput() {
    return definitions.reduce((result, def) => {
      return Object.assign(result, def.getOutput());
    }, {});
  }

  function getDefinitionById(definitionId) {
    return definitions.find((def) => def.id === definitionId);
  }

  function getPendingActivities() {
    return definitions.map((def) => def.getPendingActivities());
  }

  function signal(childId, message) {
    for (let i = 0; i < definitions.length; i++) {
      if (definitions[i].signal(childId, message)) return;
    }
  }

  function load(callback) {
    if (definitions.length) return callback(null, definitions);

    transformSources(sources, (err, transformed) => {
      if (err) return complete(err);

      definitions.push(...transformed.map((mc) => Definition(mc, executeOptions)));
      debug(`<${name}> loaded ${definitions.length} definition(s)`);

      return callback(null, definitions);
    });
  }

  function completeCallback(callback) {
    return (err, ...args) => {
      teardown();
      if (err) {
        if (callback) return callback(err, ...args);
        emit('error', executionApi, err, ...args);
      }
      debug(`<${name}> completed`);
      if (callback) callback(err, ...args);
      emit('end', executionApi, ...args);
    };
  }

  function setup() {
    definitions.forEach((def) => {
      def.on('enter', onEnter);
      def.on('end', onEnd);
      def.on('error', onError);
    });
  }

  function teardown() {
    definitions.forEach((def) => {
      def.removeListener('enter', onEnter);
      def.removeListener('end', onEnd);
      def.removeListener('error', onError);
    });
  }

  function onEnter(definitionApi, definitionExecution) {
    debug(`<${definitionApi.id}> entered`);
    emit('start', executionApi, definitionExecution);
    running.push(definitionExecution);
  }

  function onEnd(definitionApi, definitionExecution) {
    debug(`<${definitionApi.id}> completed`);

    const runningIndex = running.findIndex((p) => p === definitionExecution);
    if (runningIndex > -1) {
      debug(`<${name}> completed <${definitionExecution.id}>`);
      completed.push(running[runningIndex]);
      running.splice(runningIndex, 1);
    }

    if (!running.length) {
      complete(null, definitionApi);
    }
  }

  function onError(error, ...args) {
    teardown();
    complete(error, ...args);
  }
}

function Source(source, moddleOptions) {
  let definition, moddleContext;

  return {
    moddleOptions,
    get,
    getDefinition,
    getId,
    getTransformedDefinition,
    set,
    transform
  };

  function transform(callback) {
    if (moddleContext) {
      callback(null, null, moddleContext);
      return moddleContext;
    }

    transformer.transform(source, moddleOptions, (err, transformedDefinitions, transformed) => {
      if (err) return callback(err);
      set(transformed);
      callback(err, transformedDefinitions, transformed);
    });
  }

  function set(transformed) {
    moddleContext = transformed;
  }

  function get() {
    return moddleContext;
  }

  function getId() {
    if (!moddleContext) return;
    return getPropertyValue(moddleContext, 'rootHandler.element.id', 'anonymous');
  }

  function getTransformedDefinition(executeOptions) {
    if (!moddleContext) return;
    return new Definition(moddleContext, executeOptions);
  }

  function getDefinition(executeGetOptions, getCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(executeGetOptions, getCallback);
    transform((err) => {
      if (err) return callback(err);
      definition = new Definition(moddleContext, executeOptions);
      return callback(null, definition);
    });
  }
}

function transformSources(sources, callback) {
  if (!sources.length) callback(null, []);

  let completedTransform = false;
  const transformed = new Array(sources.length);
  const transformers = sources.map((source, idx) => {
    const cb = transformCallback(source, idx);
    return () => source.transform(cb);
  });

  return transformers.forEach((fn) => {
    if (!completedTransform) fn();
  });

  function completeTransformCallback(err) {
    if (completedTransform) return;
    callback(err, transformed);
    completedTransform = true;
  }

  function transformCallback(source, idx) {
    return function transformCb(err, def, moddleContext) {
      if (err) return completeTransformCallback(err);
      transformers.pop();
      transformed[idx] = moddleContext;
      if (!transformers.length) completeTransformCallback();
    };
  }
}

