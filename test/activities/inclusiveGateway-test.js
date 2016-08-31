'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('inclusiveGateway', () => {
  lab.test('should have inbound and outbound sequence flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="theEnd1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);

      const gateway = execution.getChildActivityById('decision');
      expect(gateway).to.include('inbound');
      expect(gateway.inbound).to.have.length(1);
      expect(gateway).to.include('outbound');
      expect(gateway.outbound).to.have.length(3);
      done();
    });
  });

  lab.test('should support multiple conditional flows, case 1', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="theEnd1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
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

          expect(Object.keys(execution.children).length).to.equal(5);
          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.true();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.include('flow2');
          expect(execution.paths).to.include('flow3');
          expect(execution.paths).to.include('flow4');
          done();
        }
      });
    });
  });

  lab.test('should support the default flow in combination with multiple conditional flows, case condition met', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" default="flow2" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="theEnd1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 50
    }, null, (err, execution) => {
      if (err) return done(err);

      execution.on('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.false();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.false();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.not.include('flow2');
          expect(execution.paths).to.include('flow3');
          expect(execution.paths).to.not.include('flow4');
          done();
        }
      });
    });
  });

  lab.test('should support the default flow in combination with multiple conditional flows, case no conditions met', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" default="flow2" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="theEnd1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance({
      input: 60
    }, null, (err, execution) => {
      if (err) return done(err);

      execution.on('end', (e) => {
        if (e.activity.id === 'theProcess') {
          expect(execution.isEnded).to.equal(true);

          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.false();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.false();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.include('flow2');
          expect(execution.paths).to.not.include('flow3');
          expect(execution.paths).to.not.include('flow4');
          done();
        }
      });
    });
  });

  lab.test('emits error when no conditional flow is taken', (done) => {
    const definitionXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="theEnd1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.context.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(definitionXml);
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
