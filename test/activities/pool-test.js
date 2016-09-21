'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const expect = Code.expect;

lab.experiment('Pool', () => {
  const processXml = factory.resource('pool.bpmn');

  lab.test('main process stores outbound messageFlows', (done) => {
    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, mainInstance) => {
      if (err) return done(err);

      expect(mainInstance.context.messageFlows.length).to.equal(1);

      done();
    });
  });

  lab.test('completes process', (done) => {
    const listener = new EventEmitter();
    const engine = new Bpmn.Engine(processXml);

    engine.once('end', () => {
      testHelper.expectNoLingeringListenersOnEngine(engine);
      done();
    });

    engine.startInstance({
      input: 0
    }, listener, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('participant startEvent receives and stores message on process context', (done) => {
    const listener = new EventEmitter();
    const engine = new Bpmn.Engine(processXml);

    engine.once('end', () => {
      const participant = engine.processes.find((p) => p.id === 'participantProcess');
      expect(participant.variables).to.include({input: 0, message: 'I\'m done', arbval: '10'});

      const mainProcess = engine.processes.find((p) => p.id === 'mainProcess');
      expect(mainProcess.variables.taskInput).to.include({
        intermediate: {
          message: 'Done! Aswell!'
        }
      });

      done();
    });

    engine.startInstance({
      input: 0
    }, listener, (err) => {
      if (err) return done(err);
    });
  });
});
