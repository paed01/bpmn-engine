'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('ExclusiveGateway', () => {

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const activity = execution.getChildActivityById('decision');
      expect(activity).to.include('inbound');
      expect(activity.inbound).to.have.length(1);
      expect(activity).to.include('outbound');
      expect(activity.outbound).to.have.length(1);
      done();
    });
  });

  lab.test('should support one diverging flow without a condition', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <exclusiveGateway id="decision" />
  <endEvent id="end" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
  <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />
</process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err, execution) => {
      if (err) return done(err);
      execution.once('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(Object.keys(execution.children).length).to.equal(3);
          done();
        }
      });
    });
  });

  lab.test('should not support a single diverging flow with a condition', (done) => {

    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err) => {
      expect(err).to.exist();
      done();
    });
  });

  lab.test('should not support multiple diverging flows without conditions', (done) => {

    // if there multiple outgoing sequence flows without conditions, an exception is thrown at deploy time,
    // even if one of them is the default flow

    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err) => {
      expect(err).to.exist();
      done();
    });

  });

  lab.test('should support two diverging flows with conditions, case 10', (done) => {

    // case 1: input  = 10 -> the upper sequenceflow is taken

    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 10
    }, null, (err, execution) => {
      if (err) return done(err);

      execution.once('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(Object.keys(execution.children).length).to.equal(3);
          expect(execution.getChildActivityById('end1').taken).to.be.true();
          expect(execution.getChildActivityById('end2').taken, 'end2').to.be.false();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.include('flow2');
          expect(execution.paths).to.not.include('flow3');
          done();
        }
      });
    });
  });

  lab.test('should support two diverging flows with conditions, case 100', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 100
    }, null, (err, execution) => {
      if (err) return done(err);

      execution.once('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(Object.keys(execution.children).length).to.equal(3);
          expect(execution.getChildActivityById('end1').taken, 'end1').to.be.false();
          expect(execution.getChildActivityById('end2').taken, 'end2').to.be.true();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.not.include('flow2');
          expect(execution.paths).to.include('flow3');
          done();
        }
      });
    });
  });

  lab.test('should support diverging flows with default, case 1', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 100
    }, null, (err, execution) => {
      if (err) return done(err);

      execution.once('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(Object.keys(execution.children).length).to.equal(3);
          expect(execution.getChildActivityById('end1').taken, 'end1').to.be.true();
          expect(execution.getChildActivityById('end2').taken, 'end2').to.be.false();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.include('flow2');
          expect(execution.paths).to.not.include('flow3');
          done();
        }
      });
    });
  });

  lab.test('should support diverging flows with default, case 2', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 50
    }, null, (err, execution) => {
      if (err) return done(err);

      execution.once('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(Object.keys(execution.children).length).to.equal(3);
          expect(execution.getChildActivityById('end1').taken, 'end1').to.be.false();
          expect(execution.getChildActivityById('end2').taken, 'end2').to.be.true();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.not.include('flow2');
          expect(execution.paths).to.include('flow3');
          done();
        }
      });
    });
  });

  lab.test('emits error when no conditional flow is taken', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 60
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 61
    }, null, (err, execution) => {
      if (err) return done(err);
      execution.once('error', () => {
        done();
      });
    });
  });
});
