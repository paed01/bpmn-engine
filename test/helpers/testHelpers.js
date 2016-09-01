'use strict';

const pub = {};

const expect = require('code').expect;

pub.expectNoLingeringListeners = (execution) => {
  Object.keys(execution.children).forEach((id) => {
    const child = execution.children[id];
    expect(child.listenerCount('start'), `start listeners on <${id}>`).to.equal(0);
    expect(child.listenerCount('end'), `end listeners on <${id}>`).to.equal(0);
  });
  execution.sequenceFlows.forEach((flow) => {
    expect(flow.listenerCount('taken'), `taken listeners on <${flow.activity.element.id}>`).to.equal(0);
    expect(flow.listenerCount('discarded'), `discarded listeners on <${flow.activity.element.id}>`).to.equal(0);
  });
};

module.exports = pub;
