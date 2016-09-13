'use strict';

const debug = require('debug')('bpmn-engine:test');
const expect = require('code').expect;

const pub = {};

pub.expectNoLingeringListeners = (execution) => {
  Object.keys(execution.children).forEach((id) => {
    debug(`check listeners of <${id}>`);
    const child = execution.children[id];

    checkListeners(child, ['enter', 'start', 'end', 'wait', 'cancel', 'leave'], '');

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
  execution.sequenceFlows.forEach((flow) => {
    debug(`check listeners of flow <${flow.id}>`);

    expect(flow.listenerCount('taken'), `taken listeners on <${flow.activity.element.id}>`).to.equal(0);
    expect(flow.listenerCount('discarded'), `discarded listeners on <${flow.activity.element.id}>`).to.equal(0);
  });
};

function checkListeners(child, names, scope) {
  names.forEach((name) => {
    const childId = child.id ? ` <${child.id}>` : '';
    expect(child.listenerCount(name), `${name} listeners on ${child.activity.$type}${childId}${scope}`).to.equal(0);
  });
}

module.exports = pub;
