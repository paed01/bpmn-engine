'use strict';

const debug = require('debug')('bpmn-engine:engine');
const Definition = require('../definition');
const {transformSources} = require('./sources');

module.exports = Execution;

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
