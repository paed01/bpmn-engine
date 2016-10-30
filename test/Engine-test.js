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
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      expect(engine.source).to.exist();
      done();
    });

    lab.test('accepts Buffer', (done) => {
      const buff = new Buffer(factory.valid());
      const engine = new Bpmn.Engine({
        source: buff
      });
      engine.execute((err) => {
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


  lab.experiment('#getInstance', () => {
    lab.test('after transform engine id is definition id', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid('myValidDefinition')
      });
      engine.getInstance(() => {
        expect(engine.id).to.equal('myValidDefinition');
        done();
      });
    });
  });

  lab.experiment('#execute', () => {
    lab.test('sets entry point id to executable process', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      engine.execute((err) => {
        expect(err).to.not.exist();
        expect(engine.entryPointId).to.equal('theProcess1');
        done();
      });
    });

    lab.test('returns error in callback if no source', (done) => {
      const engine = new Bpmn.Engine({
        source: ''
      });
      engine.execute((err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.execute((err) => {
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

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err) => {
        expect(err).to.be.an.error(/no executable process/);
        done();
      });
    });

    lab.test('emits end when all processes are completed', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.resource('lanes.bpmn')
      });
      engine.once('end', () => {
        testHelper.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.execute((err) => {
        if (err) return done(err);
      });
    });
  });
});
