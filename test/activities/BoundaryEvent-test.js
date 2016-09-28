'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const testHelper = require('../helpers/testHelpers');
const TimerEvent = require('../../lib/mapper')('bpmn:TimerEventDefinition');
const ErrorEvent = require('../../lib/mapper')('bpmn:ErrorEventDefinition');

lab.experiment('BoundaryEvent', () => {
  lab.test('returns TimerEvent type', (done) => {
    const engine = new Bpmn.Engine(factory.resource('boundary-timeout.bpmn'));
    engine.getInstance(null, null, (err, instance) => {
      if (err) return done(err);
      const event = instance.getChildActivityById('boundTimeoutEvent');
      expect(event).to.be.instanceof(TimerEvent);
      done();
    });
  });

  lab.test('returns ErrorEvent type', (done) => {
    const engine = new Bpmn.Engine(factory.resource('bound-error.bpmn'));
    engine.getInstance(null, null, (err, instance) => {
      if (err) return done(err);
      const event = instance.getChildActivityById('errorEvent');
      expect(event).to.be.instanceof(ErrorEvent);
      done();
    });
  });

  lab.test('set isStart to false and attachedTo', (done) => {
    const engine = new Bpmn.Engine(factory.resource('boundary-timeout.bpmn'));
    engine.getInstance(null, null, (err, instance) => {
      if (err) return done(err);
      const event = instance.getChildActivityById('boundTimeoutEvent');
      expect(event.isStart).to.be.false();
      expect(event.attachedTo).to.exist();
      done();
    });
  });

  lab.test('is canceled if task emits caught error', (done) => {
    const engine = new Bpmn.Engine(factory.resource('bound-error-and-timer.bpmn'));
    const listener = new EventEmitter();
    listener.once('end-timerEvent', (e) => {
      Code.fail(`<${e}> should have been discarded`);
    });

    engine.startInstance(null, listener, (err, instance) => {
      if (err) return done(err);
      instance.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });
    });
  });

  lab.test('takes timeout if no other bound event is caught', (done) => {
    const engine = new Bpmn.Engine(factory.resource('bound-error-and-timer.bpmn'));
    const listener = new EventEmitter();
    listener.once('end-errorEvent', (e) => {
      Code.fail(`<${e}> should have been discarded`);
    });

    engine.startInstance({input: 2}, listener, (err, instance) => {
      if (err) return done(err);
      instance.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });
    });
  });
});
