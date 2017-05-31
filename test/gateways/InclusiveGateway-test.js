'use strict';

const Code = require('code');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('InclusiveGateway', () => {
  lab.describe('behavior', () => {
    const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
    <process id="mainProcess" isExecutable="true">
      <inclusiveGateway id="decision" default="defaultFlow">
        <extensionElements>
          <camunda:InputOutput>
            <camunda:inputParameter name="takeCondition">\${variables.condition1}</camunda:inputParameter>
          </camunda:InputOutput>
        </extensionElements>
      </inclusiveGateway>
      <endEvent id="end1" />
      <endEvent id="end2" />
      <sequenceFlow id="condFlow" sourceRef="decision" targetRef="end1">
        <conditionExpression xsi:type="tFormalExpression">\${takeCondition}</conditionExpression>
      </sequenceFlow>
      <sequenceFlow id="defaultFlow" sourceRef="decision" targetRef="end2" />
    </process>
  </definitions>
        `;

    let context;
    lab.beforeEach((done) => {
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    lab.describe('input', () => {
      lab.test('is passed to conditional flow', (done) => {
        const gateway = context.getChildActivityById('decision');
        gateway.activate();

        context.variablesAndServices.variables.condition1 = true;

        gateway.outbound.find((f) => f.id === 'condFlow').once('taken', () => {
          done();
        });

        gateway.run();
      });
    });
  });

  lab.describe('engine behavior', () => {
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
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.getDefinition((err, definition) => {
        if (err) return done(err);

        const gateway = definition.getChildActivityById('decision');
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
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 1
        }
      }, (err, execution) => {
        if (err) return done(err);

        execution.on('end', () => {
          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.true();
          done();
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
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 50
        }
      }, (err, execution) => {
        if (err) return done(err);

        execution.on('end', () => {
          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.false();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.false();
          done();
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
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 60
        }
      }, (err, execution) => {
        if (err) return done(err);

        execution.on('end', () => {
          expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
          expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.false();
          expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.false();
          done();
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
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: definitionXml
      });
      engine.once('error', (err, gateway) => {
        expect(err).to.be.an.error(/no conditional flow/i);
        expect(gateway).to.include({
          id: 'decision'
        });
        done();
      });

      engine.execute({
        variables: {
          input: 61
        }
      }, (err) => {
        if (err) return done(err);
      });
    });
  });
});
