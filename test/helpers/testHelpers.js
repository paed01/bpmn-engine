'use strict';

const BpmnModdle = require('../../dist/bpmn-moddle');
const contextHelper = require('../../lib/context-helper');
const debug = require('debug')('bpmn-engine:test');
const Environment = require('../../lib/Environment');
const getOptionsAndCallback = require('../../lib/getOptionsAndCallback');
const transformer = require('../../lib/transformer');

const eventNames = ['enter', 'start', 'wait', 'end', 'cancel', 'catch', 'error', 'leave', 'message'];

module.exports = {
  context,
  expectNoLingeringChildListeners,
  expectNoLingeringListeners,
  expectNoLingeringListenersOnDefinition,
  expectNoLingeringListenersOnEngine,
  getContext,
  getModdleContext,
  moddleContext,
  readFromDb,
  serializeModdleContext,
  serviceFn
};

function expectNoLingeringChildListeners(scope) {
  Object.keys(scope.children).forEach((id) => {
    debug(`check listeners of <${id}>`);

    const child = scope.children[id];

    checkListeners(child, eventNames, '');

    // Boundary events
    if (child.boundEvents) {
      child.boundEvents.forEach((boundEvent) => {
        if (boundEvent.eventDefinitions) {
          boundEvent.eventDefinitions.forEach((eventDefinition) => {
            checkListeners(eventDefinition, eventNames, ` on <${id}>/<${boundEvent.id}>`);
          });
        }
      });
    }
  });

  scope.sequenceFlows.forEach((flow) => {
    debug(`check listeners of flow <${flow.id}>`);
    checkListeners(flow, ['taken', 'message', 'discarded', 'looped'], '');
  });
}

function expectNoLingeringListenersOnDefinition(definition) {
  definition.getProcesses().forEach((p) => {
    checkListeners(p, eventNames, ` on process <${p.id}>`);
    expectNoLingeringListeners(p);
  });
}

function expectNoLingeringListenersOnEngine(engine) {
  engine.definitions.forEach((d) => {
    checkListeners(d, eventNames, ` on definition <${d.id}>`);
    expectNoLingeringListenersOnDefinition(d);
  });
}

function expectNoLingeringListeners(instance) {
  return expectNoLingeringChildListeners(instance.context);
}

function checkListeners(child, names, scope) {
  names.forEach((name) => {
    const childId = child.id ? ` <${child.id}>` : '';
    expect(child.listenerCount(name), `${name} listeners on ${child.type}${childId}${scope}`).to.equal(0);
  });
}

function getContext(processXml, optionsOrCallback, cb) {
  const [options, callback] = getOptionsAndCallback(optionsOrCallback, cb);

  const Context = require('../../lib/Context');
  transformer.transform(processXml, options, (err, definitions, moddleCtx) => {
    if (err) return callback(err);
    const ctxh = contextHelper(moddleCtx);
    const ctx = Context(ctxh.getExecutableProcessId(), moddleCtx);
    return callback(null, ctx);
  });
}

function context(source, options = {}) {
  const moddleOptions = options.moddleOptions || {};
  const {extensions} = options;

  if (options.extensions) {
    for (const key in extensions) {
      moddleOptions[key] = extensions[key].moddleOptions;
    }
  }

  const Context = require('../../lib/Context');
  return new Promise((resolve, reject) => {
    transformer.transform(source, moddleOptions, (err, definitions, moddleCtx) => {
      if (err) return reject(err);
      const ctxh = contextHelper(moddleCtx);
      const ctx = Context(ctxh.getExecutableProcessId(), moddleCtx, Environment(options));
      return resolve(ctx);
    });
  });
}

function moddleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);

  return new Promise((resolve, reject) => {
    bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source, (err, definitions, moddleCtx) => {
      if (err) return reject(err);
      resolve(moddleCtx);
    });
  });
}

function getModdleContext(processXml, optionsOrCallback, cb) {
  const [options, callback] = getOptionsAndCallback(optionsOrCallback, cb);

  const bpmnModdle = new BpmnModdle(options);

  bpmnModdle.fromXML(Buffer.isBuffer(processXml) ? processXml.toString() : processXml, (err, definitions, moddleCtx) => {
    return callback(err, moddleCtx);
  });
}

// Place holder to service test
function serviceFn(message, callback) {
  callback(null, {
    service: true
  });
}

function readFromDb(state) {
  const savedState = JSON.stringify(state);
  const loadedState = JSON.parse(savedState);
  return loadedState;
}

function serializeModdleContext(moddleCtx) {
  return JSON.stringify(contextHelper(moddleCtx).clone());
}
