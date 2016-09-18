'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');

lab.experiment('timerEventDefinition', () => {
  let instance;
  lab.before((done) => {
    const engine = new Bpmn.Engine(factory.resource('boundary-timeout.bpmn'));
    engine.getInstance(null, null, (err, processInstance) => {
      if (err) return done(err);
      instance = processInstance;
      done();
    });
  });

  lab.test('stores timeout', (done) => {
    const task = instance.getChildActivityById('userTask');
    const eventDefinition = task.boundEvents[0].eventDefinitions[0];

    expect(eventDefinition.timeout).to.be.above(0);

    done();
  });

  lab.test('emits end when timed out', (done) => {
    const task = instance.getChildActivityById('userTask');
    const eventDefinition = task.boundEvents[0].eventDefinitions[0];

    eventDefinition.once('end', done.bind(null, null));

    eventDefinition.run();
  });

  lab.test('stops timer if canceled', (done) => {
    const task = instance.getChildActivityById('userTask');
    const eventDefinition = task.boundEvents[0].eventDefinitions[0];

    eventDefinition.once('end', Code.fail.bind(null, 'No end event should have been emitted'));
    eventDefinition.once('cancel', done.bind(null, null));

    eventDefinition.run();
    eventDefinition.cancel();
  });

  lab.test('stops timer if canceled, once', (done) => {
    const task = instance.getChildActivityById('userTask');
    const eventDefinition = task.boundEvents[0].eventDefinitions[0];

    eventDefinition.once('end', Code.fail.bind(null, 'No end event should have been emitted'));
    eventDefinition.once('cancel', done.bind(null, null));

    eventDefinition.run();
    eventDefinition.cancel();
    eventDefinition.cancel();
  });
});
