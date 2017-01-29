'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelper = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../');
const expect = Code.expect;

lab.experiment('Lanes', () => {
  const processXml = factory.resource('lanes.bpmn');

  lab.test('main process stores outbound messageFlows', (done) => {
    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.getInstance((err, mainInstance) => {
      if (err) return done(err);

      expect(mainInstance.context.messageFlows.length).to.equal(1);

      done();
    });
  });

  lab.test('completes process', (done) => {
    const listener = new EventEmitter();
    const engine = new Bpmn.Engine({
      source: processXml
    });

    engine.once('end', () => {
      testHelper.expectNoLingeringListenersOnEngine(engine);
      done();
    });

    engine.execute({
      listener: listener,
      variables: {
        input: 0
      }
    }, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('participant startEvent receives and stores message on process context', (done) => {
    const listener = new EventEmitter();
    const engine = new Bpmn.Engine({
      source: processXml
    });

    listener.once('start-messageStartEvent', (event) => {
      expect(event.parentContext.variables).to.equal({
        input: 0,
        message: 'I\'m done',
        arbval: '10'
      });
    });

    engine.once('end', () => {
      const participant = engine.processes.find((p) => p.id === 'participantProcess');
      expect(participant.variables).to.include({
        input: 0,
        message: 'Done! Aswell!',
        arbval: '10'
      });

      const mainProcess = engine.processes.find((p) => p.id === 'mainProcess');
      expect(mainProcess.variables).to.include({
        message: 'I\'m done'
      });

      expect(mainProcess.variables.taskInput).to.include({
        intermediate: {
          message: 'Done! Aswell!'
        }
      });

      done();
    });

    engine.execute({
      listener: listener,
      variables: {
        input: 0
      }
    }, (err) => {
      if (err) return done(err);
    });
  });
});
