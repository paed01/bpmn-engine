'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('ParallelGateway', () => {

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const forkActivity = execution.getChildActivityById('fork');
      expect(forkActivity).to.include('inbound');
      expect(forkActivity.inbound).to.have.length(1);
      expect(forkActivity).to.include('outbound');
      expect(forkActivity.outbound).to.have.length(2);

      const joinActivity = execution.getChildActivityById('join');
      expect(joinActivity).to.include('inbound');
      expect(joinActivity.inbound).to.have.length(2);
      expect(joinActivity).to.include('outbound');
      expect(joinActivity.outbound).to.have.length(1);
      done();
    });
  });
});
