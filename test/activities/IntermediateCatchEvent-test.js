'use strict';

const Code = require('code');
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const expect = Code.expect;

const mapper = require('../../lib/mapper');
const TimerEvent = mapper('bpmn:TimerEventDefinition');
const MessageEvent = mapper('bpmn:MessageEventDefinition');

lab.experiment('IntermediateCatchEvent', () => {
  lab.test('TimerEvent', (done) => {
    const processXml = factory.resource('timer-event.bpmn');
    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.getDefinition((err, definition) => {
      if (err) return done(err);
      expect(definition.getChildActivityById('duration')).to.be.instanceOf(TimerEvent);
      done();
    });
  });

  lab.test('MessageEvent', (done) => {
    const processXml = factory.resource('lanes.bpmn');
    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.getDefinition((err, definition) => {
      if (err) return done(err);
      expect(definition.getChildActivityById('intermediate')).to.be.instanceOf(MessageEvent);
      done();
    });
  });
});
