'use strict';

const BpmnModdle = require('bpmn-moddle');
const debug = require('debug')('bpmn-engine:test');
const contextHelper = require('../../lib/context-helper');
const expect = require('lab').expect;
const transformer = require('../../lib/transformer');

const pub = {};
const eventNames = ['enter', 'start', 'wait', 'end', 'cancel', 'catch', 'error', 'leave', 'message'];

pub.expectNoLingeringChildListeners = (context) => {
  Object.keys(context.children).forEach((id) => {
    debug(`check listeners of <${id}>`);
    const child = context.children[id];

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

  context.sequenceFlows.forEach((flow) => {
    debug(`check listeners of flow <${flow.id}>`);
    checkListeners(flow, ['taken', 'message', 'discarded', 'looped'], '');
  });
};

pub.expectNoLingeringListenersOnDefinition = (definition) => {
  definition.getProcesses().forEach((p) => {
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

pub.expectNoLingeringListeners = (instance) => {
  return pub.expectNoLingeringChildListeners(instance.context);
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
    const ctxh = contextHelper(moddleContext);
    const context = Context(ctxh.getExecutableProcessId(), moddleContext);
    return callback(null, context);
  });
};

pub.cloneContext = function(sourceContext) {
  const Context = require('../../lib/Context');
  const ctxh = contextHelper(sourceContext.moddleContext);
  return Context(ctxh.getExecutableProcessId(), sourceContext.moddleContext);
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
  const savedState = JSON.stringify(state);
  const loadedState = JSON.parse(savedState);
  return loadedState;
};

pub.serializeModdleContext = (moddleContext) => {
  return JSON.stringify(contextHelper(moddleContext).clone());
};

module.exports = pub;
