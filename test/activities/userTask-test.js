'use strict';

const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('userTask', () => {
  const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <userTask id="userTask" />
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
  <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const activity = execution.getChildActivityById('userTask');
      expect(activity).to.include('inbound');
      expect(activity.inbound).to.have.length(1);
      expect(activity).to.include('outbound');
      expect(activity.outbound).to.have.length(1);
      done();
    });
  });

  lab.test('should handle user tasks as wait states', (done) => {
    const engine = new Bpmn.Engine(processXml);
    const listener = new EventEmitter();

    listener.once('start-userTask', (activity) => {
      activity.signal();
    });

    engine.startInstance(null, listener, (err, execution) => {
      if (err) return done(err);

      execution.once('end', () => {
        done();
      });
    });
  });

  lab.test('should signal user task by id', (done) => {
    const engine = new Bpmn.Engine(processXml);
    const listener = new EventEmitter();

    engine.startInstance(null, listener, (err, execution) => {
      if (err) return done(err);

      listener.once('start-userTask', () => {
        execution.signal('userTask');
      });

      execution.once('end', () => {
        done();
      });
    });
  });
});
