'use strict';

const debug = require('debug')('bpmn-engine:test');
const contextHelper = require('../../lib/context-helper');
const expect = require('code').expect;
const transformer = require('../../lib/transformer');

const pub = {};

pub.expectNoLingeringListeners = (instance) => {
  Object.keys(instance.context.children).forEach((id) => {
    debug(`check listeners of <${id}>`);
    const child = instance.context.children[id];

    checkListeners(child, ['enter', 'start', 'wait', 'end', 'cancel', 'error', 'leave'], '');

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

pub.expectNoLingeringListenersOnEngine = (instance) => {
  instance.processes.forEach((p) => {
    checkListeners(p, ['enter', 'start', 'wait', 'end', 'cancel', 'error', 'leave'], '');
    pub.expectNoLingeringListeners(p);
  });
};

function checkListeners(child, names, scope) {
  names.forEach((name) => {
    const childId = child.id ? ` <${child.id}>` : '';
    expect(child.listenerCount(name), `${name} listeners on ${child.type}${childId}${scope}`).to.equal(0);
  });
}

pub.getContext = function(processXml, callback) {
  const Context = require('../../lib/Context');
  transformer.transform(processXml, {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }, (err, definitions, moddleContext) => {
    if (err) return callback(err);
    const context = new Context(contextHelper.getExecutableProcessId(moddleContext), moddleContext, {});
    return callback(null, context);
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
