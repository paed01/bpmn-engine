'use strict';

const Activity = require('../../lib/activities/Activity');
const BaseProcess = require('../../lib/mapper').Process;
const Bpmn = require('../..');
const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const EndEvent = require('../../lib/events/EndEvent');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;


lab.experiment('Activity', () => {
  const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" name="Start" />
    <userTask id="task">
      <extensionElements>
        <camunda:properties>
          <camunda:property name="me" value="too" />
          <camunda:property name="resolved" value="\${variables.boolval}" />
          <camunda:property name="serviceval" value="\${services.negate(variables.boolval)}" />
        </camunda:properties>
      </extensionElements>
    </userTask>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

  let activity, context; //, instance;
  lab.beforeEach((done) => {
    testHelpers.getContext(processXml, {
      camunda: require('camunda-bpmn-moddle/resources/camunda')
    }, (cerr, result) => {
      if (cerr) return done(cerr);
      context = result;
      activity = context.getChildActivityById('start');
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

  lab.describe('enter()', () => {
    lab.test('throws an error if entered more than once', (done) => {
      activity.enter();
      expect(() => {
        activity.enter();
      }).to.throw(Error);
      done();
    });
  });

  lab.describe('leave()', () => {
    lab.test('throws an error if left before entered', (done) => {
      expect(activity).to.be.instanceof(Activity);
      expect(() => {
        activity.leave();
      }).to.throw(Error);
      done();
    });
  });

  lab.describe('onLoopedInbound()', () => {
    lab.test('leaves if entered', (done) => {
      const task = context.getChildActivityById('task');
      task.once('leave', () => {
        done();
      });

      task.activate();
      task.enter();
      task.inbound[0].emit('looped');
    });
  });

  lab.describe('discard()', () => {

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

  lab.describe('activate()', () => {
    lab.test('sets up inbound sequenceFlow listeners', (done) => {
      const endEvent = new EndEvent(context.moddleContext.elementsById.end, context);
      endEvent.activate();
      expect(endEvent.inbound[0].listenerCount('taken')).to.equal(1);
      expect(endEvent.inbound[0].listenerCount('discarded')).to.equal(1);
      done();
    });

    lab.test('sets up inbound sequenceFlow listeners once', (done) => {
      const endEvent = new EndEvent(context.moddleContext.elementsById.end, context);
      endEvent.activate();
      endEvent.activate();
      expect(context.sequenceFlows[1].listenerCount('taken')).to.equal(1);
      expect(context.sequenceFlows[1].listenerCount('discarded')).to.equal(1);
      done();
    });
  });

  lab.describe('deactivate()', () => {
    lab.test('tears down inbound sequenceFlow listeners', (done) => {
      const endEvent = new EndEvent(context.moddleContext.elementsById.end, context);
      endEvent.activate();
      endEvent.deactivate();
      expect(context.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(context.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
      done();
    });

    lab.test('tears down inbound sequenceFlow listeners once', (done) => {
      const endEvent = new EndEvent(context.moddleContext.elementsById.end, context);
      endEvent.activate();
      endEvent.deactivate();
      endEvent.deactivate();
      expect(context.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(context.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
      done();
    });
  });

  lab.describe('cancel()', () => {
    lab.test('cancels activity and takes all outbound', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (a) => {
        a.cancel();
      });

      task.once('leave', () => {
        expect(task.canceled).to.be.true();
        expect(task.outbound.length).to.be.above(0);
        task.outbound.forEach((f) => expect(f.taken).to.be.true());
        done();
      });

      task.run();
    });

    lab.test('returns cancel flag when getting state', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (a) => {
        a.cancel();
      });

      task.once('leave', () => {
        expect(task.getState().canceled).to.be.true();
        done();
      });

      task.run();
    });

    lab.test('resets cancel flag ran again', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (a) => {
        a.cancel();
      });

      task.once('leave', () => {
        task.once('wait', (a) => {
          expect(task.canceled).to.be.false();
          a.signal();
        });
        task.once('leave', () => {
          expect(task.canceled).to.be.false();
          done();
        });
        task.run();
      });

      task.run();
    });

    lab.test('sets cancel flag when resumed', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (a) => {
        a.cancel();
      });

      task.once('leave', () => {
        const state = task.getState();

        const newContext = testHelpers.cloneContext(context);
        const taskToResume = newContext.getChildActivityById('end');

        taskToResume.resume(state);
        expect(taskToResume.canceled).to.be.true();
        done();
      });

      task.run();
    });
  });

  lab.describe('getInput()', () => {
    lab.test('returns message if no io', (done) => {
      const start = context.getChildActivityById('start');

      expect(start.getInput(1)).to.equal(1);

      done();
    });
  });

  lab.describe('getOutput()', () => {
    lab.test('returns message if no io', (done) => {
      const start = context.getChildActivityById('start');

      expect(start.getOutput(1)).to.equal(1);

      done();
    });
  });

  lab.describe('properties', () => {
    lab.test('is exposed when process loads activity', (done) => {
      const instance = new BaseProcess(context.moddleContext.elementsById.theProcess, context.moddleContext, {
        services: {
          negate: (val) => {
            return !val;
          }
        },
        variables: {
          boolval: true
        }
      });
      const task = instance.getChildActivityById('task');

      expect(task.properties).to.equal({
        me: 'too',
        resolved: true,
        serviceval: false
      });

      done();
    });
  });

  lab.describe('getState()', () => {
    lab.test('returns taken flag if taken', (done) => {
      const end = context.getChildActivityById('end');

      end.once('end', () => {
        expect(end.getState().taken).to.be.true();
        done();
      });

      end.run();
    });
  });

  lab.describe('resume()', () => {
    lab.test('sets taken flag when resumed', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (a) => {
        a.signal();
      });

      task.once('leave', () => {
        const state = task.getState();

        const newContext = testHelpers.cloneContext(context);
        const taskToResume = newContext.getChildActivityById('end');

        taskToResume.resume(state);
        expect(taskToResume.taken).to.be.true();
        done();
      });

      task.run();
    });
  });
});
