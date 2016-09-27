'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
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
});
