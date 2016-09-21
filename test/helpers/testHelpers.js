'use strict';

const debug = require('debug')('bpmn-engine:test');
const expect = require('code').expect;

const pub = {};

pub.expectNoLingeringListeners = (instance) => {
  Object.keys(instance.context.children).forEach((id) => {
    debug(`check listeners of <${id}>`);
    const child = instance.context.children[id];

    checkListeners(child, ['enter', 'start', 'wait', 'end', 'cancel', 'leave'], '');

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
    checkListeners(p, ['end', 'message'], '');
    pub.expectNoLingeringListeners(p);
  });
};

function checkListeners(child, names, scope) {
  names.forEach((name) => {
    const childId = child.id ? ` <${child.id}>` : '';
    expect(child.listenerCount(name), `${name} listeners on ${child.type}${childId}${scope}`).to.equal(0);
  });
}

module.exports = pub;
