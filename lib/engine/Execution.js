'use strict';

// const debug = require('debug')('bpmn-engine:engine');
// const Definition = require('../definition');
const elements = require('bpmn-elements');
const {transformSources} = require('./sources');
const {default: serializer, TypeResolver} = require('moddle-context-serializer');

const {Context, Definition} = elements;

module.exports = Execution;

function Execution(engine, emit, executeOptions) {
  const {name, logger} = engine;
  const sources = engine.sources.slice();
  const completed = [], definitions = [], running = [];
  const {listener} = executeOptions;
  let contexts;

  let complete;

  const typeResolver = TypeResolver(elements);

  const executionApi = {
    name,
    type: 'engine-execution',
    execute,
    getDefinitionById,
    getPendingActivities,
    getOutput,
    getState,
    resurrect,
    resume,
    signal,
    waitFor,
    stop
  };

  return executionApi;

  function waitFor(eventName) {
    const prom = new Promise((resolve) => {
      engine.once(eventName, (...args) => {
        resolve(args);
      });
    });
    return prom;
  }

  function execute(callback) {
    complete = completeCallback(callback);

    load((err) => {
      if (err) return complete(err);
      if (!definitions.length) return complete(new Error('Nothing to execute'));

      logger.debug(`<${name}> executing ${definitions.length} definitions`);

      setup();

      definitions.forEach((def) => def.run());
    });
  }

  function resurrect(state) {
    const definitionStates = state.definitions;
    definitions.splice();
    definitions.push(...definitionStates.map((defState) => Definition.resurrect(defState, executeOptions)));
    return executionApi;
  }

  function resume(state, callback) {
    const definitionStates = state.definitions;
    complete = completeCallback(callback);

    load((err) => {
      if (err) return complete(err);
      if (!definitions.length) return complete(new Error('Nothing to execute'));

      logger.debug(`<${name}> resuming ${definitions.length} definitions`);

      setup();

      definitions.forEach((def, idx) => def.resume(definitionStates[idx], executeOptions));
    });
  }

  function stop() {
    definitions.forEach((definition) => definition.stop());
  }

  function getState() {
    return {
      sources: contexts.map((c) => JSON.parse(c.serialize())),
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

      contexts = transformed.map((mc) => serializer(mc, typeResolver));

      // definitions.push(...transformed.map((mc) => Definition(mc, executeOptions)));
      definitions.push(...contexts.map((src) => Definition(Context(src), executeOptions)));
      logger.debug(`<${name}> loaded ${definitions.length} definition(s)`);

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
      logger.debug(`<${name}> completed`);
      if (callback) callback(err, ...args);
      emit('end', executionApi, ...args);
    };
  }

  function setup() {
    definitions.forEach((def) => {
      def.broker.subscribeTmp('event', 'activity.wait', (_, msg) => {
        dispatchEvent('wait', def.getApi(msg));
      }, {noAck: true, consumerTag: '_definition_activity-wait'});
    });

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
    logger.debug(`<${definitionApi.id}> entered`);
    emit('start', executionApi, definitionExecution);
    running.push(definitionExecution);
  }

  function onEnd(definitionApi, definitionExecution) {
    logger.debug(`<${definitionApi.id}> completed`);

    const runningIndex = running.findIndex((p) => p === definitionExecution);
    if (runningIndex > -1) {
      logger.debug(`<${name}> completed <${definitionExecution.id}>`);
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

  function dispatchEvent(...args) {
    if (!listener || !listener.emit) return;
    listener.emit(...args);
  }
}
