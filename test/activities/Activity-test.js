'use strict';

const Activity = require('../../lib/activities/Activity');
const Code = require('code');
const Lab = require('lab');
const EndEvent = require('../../lib/events/EndEvent');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('Activity', () => {
  const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
  </process>
</definitions>`;

  let activity, instance;
  lab.beforeEach((done) => {
    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, inst) => {
      if (err) return done(err);
      instance = inst;
      activity = inst.getChildActivityById('start');
      expect(activity).to.be.instanceof(Activity);
      done();
    });
  });

  lab.experiment('#enter', () => {
    lab.test('throws an error if entered more than once', (done) => {
      activity.enter();
      expect(() => {
        activity.enter();
      }).to.throw(Error);
      done();
    });
  });

  lab.experiment('#leave', () => {
    lab.test('throws an error if left before entered', (done) => {
      expect(activity).to.be.instanceof(Activity);
      expect(() => {
        activity.leave();
      }).to.throw(Error);
      done();
    });
  });

  lab.experiment('#activate', () => {
    lab.test('sets up inbound sequenceFlow listeners', (done) => {
      const endEvent = new EndEvent(instance.context.elementsById.end, instance);
      endEvent.activate();
      expect(instance.sequenceFlows[0].listenerCount('taken')).to.equal(1);
      expect(instance.sequenceFlows[0].listenerCount('discarded')).to.equal(1);
      done();
    });

    lab.test('sets up inbound sequenceFlow listeners once', (done) => {
      const endEvent = new EndEvent(instance.context.elementsById.end, instance);
      endEvent.activate();
      endEvent.activate();
      expect(instance.sequenceFlows[0].listenerCount('taken')).to.equal(1);
      expect(instance.sequenceFlows[0].listenerCount('discarded')).to.equal(1);
      done();
    });
  });

  lab.experiment('#deactivate', () => {
    lab.test('tears down inbound sequenceFlow listeners', (done) => {
      const endEvent = new EndEvent(instance.context.elementsById.end, instance);
      endEvent.activate();
      endEvent.deactivate();
      expect(instance.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(instance.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
      done();
    });

    lab.test('tears down inbound sequenceFlow listeners once', (done) => {
      const endEvent = new EndEvent(instance.context.elementsById.end, instance);
      endEvent.activate();
      endEvent.deactivate();
      endEvent.deactivate();
      expect(instance.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(instance.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
      done();
    });
  });
});
