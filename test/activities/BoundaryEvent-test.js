'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');

lab.experiment('BoundaryEvent', () => {
  lab.describe('ctor', () => {
    lab.test('stores eventDefinitions', (done) => {
      const engine = new Bpmn.Engine(factory.resource('boundary-timeout.bpmn'));
      engine.getInstance(null, null, (err, instance) => {
        if (err) return done(err);
        const task = instance.getChildActivityById('userTask');
        const event = task.boundEvents[0];
        expect(event.eventDefinitions.length).to.be.above(0);
        done();
      });
    });
  });

  lab.describe('with duration timerEventDefinition that cancel task', () => {
    let event, instance;
    lab.before((done) => {
      const engine = new Bpmn.Engine(factory.resource('boundary-timeout.bpmn'));
      engine.getInstance(null, null, (err, processInstance) => {
        if (err) return done(err);
        instance = processInstance;
        const task = instance.getChildActivityById('userTask');
        event = task.boundEvents[0];
        done();
      });
    });

    lab.test('has property cancelActivity true', (done) => {
      expect(event).to.include({cancelActivity: true});
      done();
    });

    lab.test('emits end when timed out', (done) => {
      event.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
    });

    lab.test('and takes outbound sequenceFlows', (done) => {

      event.outbound[0].once('taken', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
    });

    lab.test('discards outbound sequenceFlows if canceled', (done) => {
      event.outbound[0].once('discarded', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
      event.cancel();
    });
  });

  lab.describe('with duration timerEventDefinition', () => {
    let event, instance;
    lab.before((done) => {
      const engine = new Bpmn.Engine(factory.resource('boundary-non-interupting-timer.bpmn'));
      engine.getInstance(null, null, (err, processInstance) => {
        if (err) return done(err);
        instance = processInstance;
        const task = instance.getChildActivityById('userTask');
        event = task.boundEvents[0];
        done();
      });
    });

    lab.test('has property cancelActivity false', (done) => {
      expect(event).to.include({cancelActivity: false});
      done();
    });

    lab.test('emits end when timed out', (done) => {
      event.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
    });

    lab.test('and takes outbound sequenceFlows', (done) => {
      event.outbound[0].once('taken', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
    });

    lab.test('discards outbound sequenceFlows if canceled', (done) => {
      event.outbound[0].once('discarded', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });

      event.run();
      event.cancel();
    });
  });

  lab.describe('listeners', () => {
    let event;
    lab.beforeEach((done) => {
      const engine = new Bpmn.Engine(factory.resource('simple-task.bpmn'));
      engine.getInstance(null, null, (err, execution) => {
        if (err) return done(err);
        event = execution.getChildActivityById('task').boundEvents[0];
        done();
      });
    });

    lab.test('attaches event listener when runned', (done) => {
      event.run();

      expect(event.eventDefinitions[0].listenerCount('end')).to.equal(1);
      expect(event.eventDefinitions[0].listenerCount('cancel')).to.equal(1);

      done();
    });

    lab.test('that are removed when completed', (done) => {
      event.run();
      event.once('end', () => {
        expect(event.eventDefinitions[0].listenerCount('end')).to.equal(0);
        expect(event.eventDefinitions[0].listenerCount('cancel')).to.equal(0);
        done();
      });
    });

    lab.describe('#setupDefinitionEventListeners', () => {
      lab.test('sets up listeners', (done) => {
        event.setupDefinitionEventListeners();

        expect(event.eventDefinitions[0].listenerCount('end')).to.equal(1);
        expect(event.eventDefinitions[0].listenerCount('cancel')).to.equal(1);

        done();
      });

      lab.test('sets up listeners once', (done) => {
        event.setupDefinitionEventListeners();
        event.setupDefinitionEventListeners();

        expect(event.eventDefinitions[0].listenerCount('end')).to.equal(1);
        expect(event.eventDefinitions[0].listenerCount('cancel')).to.equal(1);

        done();
      });
    });

    lab.describe('#teardownDefinitionEventListeners', () => {
      lab.test('tears down listeners', (done) => {
        event.setupDefinitionEventListeners();
        event.teardownDefinitionEventListeners();

        expect(event.eventDefinitions[0].listenerCount('end')).to.equal(0);
        expect(event.eventDefinitions[0].listenerCount('cancel')).to.equal(0);

        done();
      });

      lab.test('tears down listeners once', (done) => {
        event.setupDefinitionEventListeners();
        event.teardownDefinitionEventListeners();
        event.teardownDefinitionEventListeners();

        expect(event.eventDefinitions[0].listenerCount('end')).to.equal(0);
        expect(event.eventDefinitions[0].listenerCount('cancel')).to.equal(0);

        done();
      });
    });
  });

});
