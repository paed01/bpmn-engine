'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('EndEvent', () => {

  lab.test('should have inbound sequence flows and flagged as end', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const event = execution.getChildActivityById('end');
      expect(event).to.include('inbound');
      expect(event.inbound).to.have.length(1);
      expect(event.inbound).to.have.length(1);
      expect(event.isEnd).to.be.true();
      done();
    });
  });

  lab.experiment('terminateEventDefinition', () => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <endEvent id="fatal">
      <terminateEventDefinition />
    </endEvent>
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fatal" />
    <sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd1" />
    <sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd2" />
    <sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd3" />
  </process>
</definitions>`;

    let instance;
    lab.before((done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.getInstance(null, null, (err, execution) => {
        if (err) return done(err);
        instance = execution;
        done();
      });
    });

    lab.test('should have inbound sequence flows', (done) => {
      const element = instance.getChildActivityById('fatal');
      expect(element).to.include('inbound');
      expect(element.inbound).to.have.length(1);
      done();
    });

    lab.test('and have property isTermation flag true', (done) => {
      const element = instance.getChildActivityById('fatal');
      expect(element.terminate).to.be.true();
      done();
    });

    lab.test('should terminate process', (done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', () => {
          expect(execution.isEnded).to.equal(true);

          expect(execution.getChildActivityById('fatal').taken, 'fatal').to.be.true();
          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.false();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.false();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.false();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.not.include('flow2');
          expect(execution.paths).to.not.include('flow3');
          expect(execution.paths).to.not.include('flow4');
          done();
        });
      });
    });

  });

});
