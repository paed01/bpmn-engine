'use strict';

const Code = require('code');
const factory = require('../helpers/factory');
const expect = Code.expect;
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const EventEmitter = require('events').EventEmitter;
const testHelper = require('../helpers/testHelpers');

lab.experiment('ErrorEventDefinition', () => {
  lab.describe('as BoundaryEvent', () => {
    const processXml = factory.resource('bound-error.bpmn');

    lab.describe('ctor', () => {
      let event, instance;
      lab.before((done) => {
        const engine = new Bpmn.Engine(processXml);
        engine.getInstance(null, null, (err, processInstance) => {
          if (err) return done(err);
          instance = processInstance;
          event = instance.getChildActivityById('errorEvent');
          done();
        });
      });

      lab.test('has property cancelActivity true', (done) => {
        expect(event).to.include({
          cancelActivity: true
        });
        done();
      });
    });

    lab.describe('interupting', () => {

      lab.test('is discarded if task completes', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();
        listener.once('start-scriptTask', (task) => {
          task.signal();
        });
        listener.once('end-errorEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.startInstance({
          input: 1
        }, listener, (err, inst) => {
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
        listener.once('enter-scriptTask', (task) => {
          task.cancel();
        });
        listener.once('end-errorEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.startInstance({
          input: 2
        }, listener, (err, inst) => {
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
        listener.once('end-scriptTask', (e) => {
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
    });
  });
});
