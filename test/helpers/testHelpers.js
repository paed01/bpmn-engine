'use strict';

const BpmnModdle = require('bpmn-moddle');
const debug = require('debug')('bpmn-engine:test');
const contextHelper = require('../../lib/context-helper');
const expect = require('code').expect;
const transformer = require('../../lib/transformer');

const pub = {};
const eventNames = ['enter', 'start', 'wait', 'end', 'cancel', 'error', 'leave', 'message'];

pub.expectNoLingeringListeners = (instance) => {
  Object.keys(instance.context.children).forEach((id) => {
    debug(`check listeners of <${id}>`);
    const child = instance.context.children[id];

    checkListeners(child, eventNames, '');

    // Boundary events
    if (child.boundEvents) {
      child.boundEvents.forEach((boundEvent) => {
        if (boundEvent.eventDefinitions) {
          boundEvent.eventDefinitions.forEach((eventDefinition) => {
            checkListeners(eventDefinition, ['end', 'cancel'], ` on <${id}>/<${boundEvent.id}>`);
          });
        }
      });
    }
  });
  instance.context.sequenceFlows.forEach((flow) => {
    debug(`check listeners of flow <${flow.id}>`);
    checkListeners(flow, ['taken', 'message', 'discarded'], '');
  });
};

pub.expectNoLingeringListenersOnDefinition = (definition) => {
  definition.processes.forEach((p) => {
    checkListeners(p, eventNames, ` on process <${p.id}>`);
    pub.expectNoLingeringListeners(p);
  });
};

pub.expectNoLingeringListenersOnEngine = (engine) => {
  engine.definitions.forEach((d) => {
    checkListeners(d, eventNames, ` on definition <${d.id}>`);
    pub.expectNoLingeringListenersOnDefinition(d);
  });
};

function checkListeners(child, names, scope) {
  names.forEach((name) => {
    const childId = child.id ? ` <${child.id}>` : '';
    expect(child.listenerCount(name), `${name} listeners on ${child.type}${childId}${scope}`).to.equal(0);
  });
}

pub.getContext = function(processXml, optionsOrCallback, callback) {
  let options = {};
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
  } else {
    options = optionsOrCallback;
  }

  const Context = require('../../lib/Context');
  transformer.transform(processXml, options, (err, definitions, moddleContext) => {
    if (err) return callback(err);
    const context = new Context(contextHelper.getExecutableProcessId(moddleContext), moddleContext, {});
    return callback(null, context);
  });
};

pub.getModdleContext = function(processXml, optionsOrCallback, callback) {
  if (!callback) {
    callback = optionsOrCallback;
    optionsOrCallback = {};
  }

  const bpmnModdle = new BpmnModdle(optionsOrCallback);

  bpmnModdle.fromXML(Buffer.isBuffer(processXml) ? processXml.toString() : processXml, (err, definitions, moddleContext) => {
    return callback(err, moddleContext);
  });
};

// Place holder to service test
pub.serviceFn = (message, callback) => {
  callback(null, {
    service: true
  });
};

pub.readFromDb = (state) => {
  const source = state.source;
  delete state.source;
  const savedState = JSON.stringify(state);
  const loadedState = JSON.parse(savedState);
  loadedState.source = source;
  return loadedState;
};

pub.serializeModdleContext = (context) => {
  return JSON.stringify(contextHelper.cloneContext(context));
};

module.exports = pub;
