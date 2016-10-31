'use strict';

const Activity = require('../../lib/activities/Activity');
const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
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
    <startEvent id="start" name="Start" />
    <userTask id="task" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

  let activity, instance;
  lab.beforeEach((done) => {
    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.getInstance((err, inst) => {
      if (err) return done(err);
      instance = inst;
      activity = inst.getChildActivityById('start');
      expect(activity).to.be.instanceof(Activity);
      done();
    });
  });

  lab.describe('ctor', () => {
    lab.test('set activity id, type and name', (done) => {
      expect(activity.id).to.equal('start');
      expect(activity.type).to.equal('bpmn:StartEvent');
      expect(activity.name).to.equal('Start');
      done();
    });
  });

  lab.describe('#enter', () => {
    lab.test('throws an error if entered more than once', (done) => {
      activity.enter();
      expect(() => {
        activity.enter();
      }).to.throw(Error);
      done();
    });
  });

  lab.describe('#leave', () => {
    lab.test('throws an error if left before entered', (done) => {
      expect(activity).to.be.instanceof(Activity);
      expect(() => {
        activity.leave();
      }).to.throw(Error);
      done();
    });
  });

  lab.describe('#discard', () => {

    lab.test('activity with multiple inbound waits for all to be discarded', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.multipleInbound()
      });
      const listener = new EventEmitter();
      listener.on('wait-userTask', (task) => {
        task.discard();
      });

      engine.execute({
        listener: listener
      }, (err, inst) => {
        if (err) return done(err);
        inst.once('end', () => {
          expect(inst.getChildActivityById('end').taken).to.be.false();
          done();
        });
      });
    });

  });

  lab.describe('#activate', () => {
    lab.test('sets up inbound sequenceFlow listeners', (done) => {
      const endEvent = new EndEvent(instance.context.moddleContext.elementsById.end, instance.context);
      endEvent.activate();
      expect(endEvent.inbound[0].listenerCount('taken')).to.equal(1);
      expect(endEvent.inbound[0].listenerCount('discarded')).to.equal(1);
      done();
    });

    lab.test('sets up inbound sequenceFlow listeners once', (done) => {
      const endEvent = new EndEvent(instance.context.moddleContext.elementsById.end, instance.context);
      endEvent.activate();
      endEvent.activate();
      expect(instance.context.sequenceFlows[1].listenerCount('taken')).to.equal(1);
      expect(instance.context.sequenceFlows[1].listenerCount('discarded')).to.equal(1);
      done();
    });
  });

  lab.describe('#deactivate', () => {
    lab.test('tears down inbound sequenceFlow listeners', (done) => {
      const endEvent = new EndEvent(instance.context.moddleContext.elementsById.end, instance.context);
      endEvent.activate();
      endEvent.deactivate();
      expect(instance.context.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(instance.context.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
      done();
    });

    lab.test('tears down inbound sequenceFlow listeners once', (done) => {
      const endEvent = new EndEvent(instance.context.moddleContext.elementsById.end, instance.context);
      endEvent.activate();
      endEvent.deactivate();
      endEvent.deactivate();
      expect(instance.context.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(instance.context.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
      done();
    });
  });

  lab.describe('#cancel', () => {
    lab.test('cancels activity and takes all outbound', (done) => {
      const task = instance.getChildActivityById('task');
      task.once('wait', (a) => {
        a.cancel();
      });

      instance.once('end', () => {
        expect(task.canceled).to.be.true();
        expect(instance.getChildActivityById('end').canceled).to.be.false();
        done();
      });
      instance.run();
    });
  });
});
