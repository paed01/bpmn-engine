'use strict';

const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;

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
      const listener = new EventEmitter();
      listener.once('end-theEnd1', (c) => {
        done(new Error(`${c.id} should have been terminated`));
      });

      engine.startInstance(null, listener, (err, execution) => {
        if (err) return done(err);

        execution.on('end', () => {
          expect(execution.isEnded).to.equal(true);

          expect(execution.getChildActivityById('fatal').taken, 'fatal').to.be.true();
          done();
        });
      });
    });

    lab.test('and leave no lingering parent eventListeners', (done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', () => {
          Object.keys(execution.children).forEach((id) => {
            const child = execution.children[id];
            expect(child.listenerCount('end'), id).to.equal(0);
            expect(child.listenerCount('start'), id).to.equal(0);
          });
          done();
        });
      });
    });
  });
});
