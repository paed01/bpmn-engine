'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const EventEmitter = require('events').EventEmitter;

lab.experiment('Intermediate Catch Event', () => {
  lab.describe('TimerEventDefinition', () => {
    const processXml = factory.resource('timer-event.bpmn');
    let event, instance;
    lab.before((done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.getDefinition((err, processInstance) => {
        if (err) return done(err);
        instance = processInstance;
        event = instance.getChildActivityById('duration');
        done();
      });
    });

    lab.test('is not starting event', (done) => {
      expect(event.isStart).to.be.false();
      done();
    });

    lab.test('waits duration', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });
      const listener = new EventEmitter();

      const calledEnds = [];
      listener.on('end', (e) => {
        calledEnds.push(e.id);
      });

      engine.execute({
        listener: listener
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(calledEnds).to.include(['task1', 'duration', 'task2']);
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });
  });
});
