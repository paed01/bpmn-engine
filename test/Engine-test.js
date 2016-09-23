'use strict';

const Code = require('code');
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelper = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('..');

lab.experiment('engine', () => {
  lab.test('Bpmn exposes executor module', (done) => {
    expect(Bpmn).to.include('Engine');
    done();
  });

  lab.experiment('#ctor', () => {
    lab.test('takes process definition as argument', (done) => {
      const engine = new Bpmn.Engine(factory.valid());
      expect(engine.source).to.exist();
      done();
    });

    lab.test('accepts Buffer', (done) => {
      const buff = new Buffer(factory.valid());
      const engine = new Bpmn.Engine(buff);
      engine.startInstance(null, null, (err) => {
        expect(err).to.not.exist();
        done();
      });
    });

    lab.test('but not function', (done) => {
      const source = () => {};
      expect(() => {
        new Bpmn.Engine(source); /* eslint no-new: 0 */
      }).to.throw();
      done();
    });
  });

  lab.experiment('#startInstance', () => {
    lab.test('sets entry point id to executable process', (done) => {
      const engine = new Bpmn.Engine(factory.valid());
      engine.startInstance(null, null, (err) => {
        expect(err).to.not.exist();
        expect(engine.entryPointId).to.equal('theProcess1');
        done();
      });
    });

    lab.test('returns error in callback if no activity definition', (done) => {
      const engine = new Bpmn.Engine('');
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine('jdalsk');
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if no executable process', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="false" />
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('emits end when all processes are completed', (done) => {
      const engine = new Bpmn.Engine(factory.resource('lanes.bpmn'));
      engine.once('end', () => {
        testHelper.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.startInstance(null, null, (err) => {
        if (err) return done(err);
      });
    });
  });
});
