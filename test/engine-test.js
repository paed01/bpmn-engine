'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const factory = require('./helpers/factory');
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
      expect(engine.source).to.exist();
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
  });

  lab.experiment('Uncontrolled flows', () => {
    lab.test('should support diverging flows', (done) => {

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />
    <sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2" />
    <sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 1
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
            expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
            expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.include('flow3');
            done();
          }
        });
      });
    });

    lab.test('should support joining flows', (done) => {

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd" />
    <sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd" />
    <sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 1
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(execution.getChildActivityById('theEnd').taken, 'theEnd').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.include('flow3');
            done();
          }
        });
      });
    });
  });
});
