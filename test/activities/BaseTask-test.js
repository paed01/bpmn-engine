'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('BaseTask', () => {

  lab.describe('#cancel', () => {
    lab.test('cancels bound events and takes all outbound', (done) => {
      const engine = new Bpmn.Engine(factory.resource('timer.bpmn'));
      const listener = new EventEmitter();
      listener.on('wait-userTask', (activity) => {
        activity.cancel();
      });

      engine.startInstance(null, listener, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.getChildActivityById('join').taken, 'join').to.be.true();
          expect(instance.getChildActivityById('end').taken, 'end').to.be.true();
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });
  });

  lab.describe('boundary events', () => {
    let task;
    lab.beforeEach((done) => {
      const engine = new Bpmn.Engine(factory.resource('simple-task.bpmn'));
      engine.getInstance(null, null, (err, execution) => {
        if (err) return done(err);
        task = execution.getChildActivityById('task');
        done();
      });
    });

    lab.test('are stored with task', (done) => {
      expect(task.boundEvents.length).to.equal(1);
      done();
    });

    lab.test('task attaches event listener when run', (done) => {
      task.boundEvents[0].once('enter', (be) => {
        expect(be.listenerCount('end')).to.equal(1);
        expect(be.listenerCount('cancel')).to.equal(1);
        done();
      });

      task.run();
    });

    lab.test('listeners are removed when completed', (done) => {
      task.boundEvents[0].once('leave', (be) => {
        expect(be.listenerCount('end')).to.equal(0);
        expect(be.listenerCount('cancel')).to.equal(0);
        done();
      });

      task.run();
    });

    lab.describe('#setupBoundEventListeners', () => {
      lab.test('sets up listeners', (done) => {
        task.setupBoundEventListeners();

        expect(task.boundEvents[0].listenerCount('end')).to.equal(1);
        expect(task.boundEvents[0].listenerCount('cancel')).to.equal(1);

        done();
      });

      lab.test('sets up listeners once', (done) => {
        task.setupBoundEventListeners();
        task.setupBoundEventListeners();

        expect(task.boundEvents[0].listenerCount('end')).to.equal(1);
        expect(task.boundEvents[0].listenerCount('cancel')).to.equal(1);

        done();
      });
    });

    lab.describe('#teardownBoundEventListeners', () => {
      lab.test('tears down listeners', (done) => {
        task.setupBoundEventListeners();
        task.teardownBoundEventListeners();

        expect(task.boundEvents[0].listenerCount('end')).to.equal(0);
        expect(task.boundEvents[0].listenerCount('cancel')).to.equal(0);

        done();
      });

      lab.test('tears down listeners once', (done) => {
        task.setupBoundEventListeners();
        task.teardownBoundEventListeners();
        task.teardownBoundEventListeners();

        expect(task.boundEvents[0].listenerCount('end')).to.equal(0);
        expect(task.boundEvents[0].listenerCount('cancel')).to.equal(0);

        done();
      });
    });
  });

  lab.describe('multiple inbounds', () => {
    const processXml = factory.resource('task-multiple-inbound.bpmn');

    lab.test('completes process', (done) => {
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();
      listener.on('wait', (activity) => {
        activity.signal({
          input: 1
        });
      });

      let taskCount = 0;
      listener.on('end-script', (a) => {
        taskCount++;
        if (taskCount > 3) {
          Code.fail(`Too many runs for <${a.id}>`);
        }
      });

      engine.startInstance({
        input: 0
      }, listener, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          done();
        });
      });

    });
  });
});
