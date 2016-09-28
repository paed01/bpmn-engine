'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const EventEmitter = require('events').EventEmitter;
const testHelper = require('../helpers/testHelpers');

lab.experiment('TimerEvent', () => {

  lab.describe('ctor', () => {
    const processXml = factory.resource('boundary-timeout.bpmn');
    let instance;
    lab.before((done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.getInstance(null, null, (err, processInstance) => {
        if (err) return done(err);
        instance = processInstance;
        done();
      });
    });

    lab.test('stores timeout', (done) => {
      const event = instance.getChildActivityById('boundTimeoutEvent');
      expect(event.timeout).to.be.above(0);
      done();
    });
  });

  lab.describe('as BoundaryEvent', () => {
    let event, instance;
    lab.before((done) => {
      const processXml = factory.resource('boundary-timeout.bpmn');
      const engine = new Bpmn.Engine(processXml);
      engine.getInstance(null, null, (err, processInstance) => {
        if (err) return done(err);
        instance = processInstance;
        event = instance.getChildActivityById('boundTimeoutEvent');
        done();
      });
    });

    lab.test('has property cancelActivity true', (done) => {
      expect(event).to.include({
        cancelActivity: true
      });
      done();
    });

    lab.test('emits end when timed out', (done) => {
      event.once('end', done.bind(null, null));
      event.run();
    });

    lab.test('stops timer if discarded', (done) => {
      event.once('end', Code.fail.bind(null, 'No end event should have been emitted'));
      event.once('leave', () => {
        expect(event.timer).to.not.exist();
        done();
      });

      event.run();
      event.discard();
    });

    lab.describe('interupting', () => {
      const processXml = factory.resource('boundary-timeout.bpmn');

      lab.test('is discarded if task completes', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.signal();
        });
        listener.once('end-boundTimeoutEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.startInstance(null, listener, (err, inst) => {
          if (err) return done(err);

          inst.once('end', () => {
            testHelper.expectNoLingeringListeners(inst);
            done();
          });
        });
      });

      lab.test('is discarded if task is canceled', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.cancel();
        });
        listener.once('end-boundTimeoutEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.startInstance(null, listener, (err, inst) => {
          if (err) return done(err);

          inst.once('end', () => {
            testHelper.expectNoLingeringListeners(inst);
            done();
          });
        });
      });

      lab.test('cancels task', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();
        listener.once('end-userTask', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.startInstance(null, null, (err, inst) => {
          if (err) return done(err);

          inst.once('end', () => {
            testHelper.expectNoLingeringListeners(inst);
            done();
          });
        });
      });
    });

    lab.describe('non-interupting', () => {
      const processXml = factory.resource('boundary-non-interupting-timer.bpmn');

      lab.test('is not discarded if task completes', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.once('wait-userTask', (task) => {
          task.signal();
        });

        const calledEnds = [];
        listener.once('end-userTask', (e) => {
          calledEnds.push(e.id);
        });

        listener.once('end-boundaryEvent', (e) => {
          calledEnds.push(e.id);
        });

        engine.startInstance(null, listener, (err, inst) => {
          if (err) return done(err);
          inst.once('end', () => {
            expect(calledEnds).to.include(['userTask', 'boundaryEvent']);
            testHelper.expectNoLingeringListeners(inst);
            done();
          });
        });
      });

      lab.test('is discarded if task is canceled', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.cancel();
        });
        listener.once('end-boundaryEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.startInstance(null, listener, (err, inst) => {
          if (err) return done(err);

          inst.once('end', () => {
            testHelper.expectNoLingeringListeners(inst);
            done();
          });
        });
      });

      lab.test('does not discard task', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        const calledEnds = [];
        listener.once('end-userTask', (e) => {
          calledEnds.push(e.id);
        });

        listener.once('end-boundaryEvent', (e) => {
          calledEnds.push(e.id);

          e.parentContext.getChildActivityById('userTask').signal();
        });

        engine.startInstance(null, listener, (err, inst) => {
          if (err) return done(err);

          inst.once('end', () => {
            expect(calledEnds).to.include(['userTask', 'boundaryEvent']);
            testHelper.expectNoLingeringListeners(inst);
            done();
          });
        });
      });
    });
  });

  lab.describe('as Intermediate Catch Event', () => {
    const processXml = factory.resource('timer-event.bpmn');
    let event, instance;
    lab.before((done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.getInstance(null, null, (err, processInstance) => {
        if (err) return done(err);
        instance = processInstance;
        event = instance.getChildActivityById('duration');
        done();
      });
    });

    lab.test('stores duration', (done) => {
      expect(event.timeout).to.be.above(0);
      done();
    });

    lab.test('stores inbound', (done) => {
      expect(event.inbound.length).to.equal(1);
      done();
    });

    lab.test('is not starting event', (done) => {
      expect(event.isStart).to.be.false(1);
      done();
    });

    lab.test('waits duration', (done) => {
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();

      const calledEnds = [];
      listener.on('end', (e) => {
        calledEnds.push(e.id);
      });

      engine.startInstance(null, listener, (err, inst) => {
        if (err) return done(err);

        inst.once('end', () => {
          expect(calledEnds).to.include(['task1', 'duration', 'task2']);
          testHelper.expectNoLingeringListeners(inst);
          done();
        });
      });
    });
  });
});
