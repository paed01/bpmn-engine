'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');

lab.experiment('boundaryEvent', () => {
  let instance;
  lab.before((done) => {
    const engine = new Bpmn.Engine(factory.resource('timer.bpmn'));
    engine.getInstance(null, null, (err, processInstance) => {
      if (err) return done(err);
      instance = processInstance;
      done();
    });
  });

  lab.test('stores eventDefinitions', (done) => {
    const task = instance.getChildActivityById('userTask');
    const event = task.boundEvents[0];
    expect(event.eventDefinitions.length).to.be.above(0);
    done();
  });


  lab.experiment('with duration timerEventDefinition', () => {
    lab.test('emits end when timed out', (done) => {
      const task = instance.getChildActivityById('userTask');
      const event = task.boundEvents[0];

      event.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
    });

    lab.test('and takes outbound sequenceFlows', (done) => {
      const task = instance.getChildActivityById('userTask');
      const event = task.boundEvents[0];

      event.outbound[0].once('taken', () => {
        done();
      });

      event.run();
    });

    lab.test('discards outbound sequenceFlows if canceled', (done) => {
      const task = instance.getChildActivityById('userTask');
      const event = task.boundEvents[0];

      event.outbound[0].once('discarded', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
      event.cancel();
    });
  });
});
