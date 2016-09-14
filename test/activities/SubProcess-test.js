'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('SubProcess', () => {
  const processXml = factory.resource('sub-process.bpmn');
  lab.test('parent process should only initialise its own', (done) => {
    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, instance) => {
      if (err) return done(err);
      expect(instance.sequenceFlows.length).to.equal(2);
      done();
    });
  });

  lab.test('completes process', (done) => {
    const listener = new EventEmitter();
    listener.on('wait-subUserTask', (task) => {
      task.signal();
    });

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 0
    }, listener, (err, execution) => {
      if (err) return done(err);
      execution.once('end', () => {
        testHelper.expectNoLingeringListeners(execution);
        testHelper.expectNoLingeringListeners(execution.getChildActivityById('subProcess').context);
        done();
      });
    });
  });

  lab.test('cancel sub-process if task is canceled', (done) => {
    const listener = new EventEmitter();
    listener.on('wait-subUserTask', (task) => {
      task.cancel();
    });

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 0
    }, listener, (err, execution) => {
      if (err) return done(err);
      execution.once('end', () => {
        testHelper.expectNoLingeringListeners(execution);
        testHelper.expectNoLingeringListeners(execution.getChildActivityById('subProcess').context);
        done();
      });
    });
  });
});
