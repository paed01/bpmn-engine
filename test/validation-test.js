'use strict';

const Code = require('code');
const Bpmn = require('..');
const Lab = require('lab');
const validation = require('../lib/validation');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const validBpmnDefinition = `
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

lab.experiment('validation', () => {
  const transformer = Bpmn.Transformer;

  lab.experiment('definitions', () => {

    lab.test('validates', (done) => {
      transformer.transform(validBpmnDefinition, (err, bpmnObject, context) => {
        if (err) return done(err);
        validation.validate(bpmnObject, context, done);
      });
    });

    lab.test('but not without process id', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process isExecutable="true" />
</definitions>`;

      transformer.transform(bpmnXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.be.an.error(/"id" is required/);
          done();
        });
      });
    });

  });

  lab.experiment('processes', () => {
    lab.test('validates', (done) => {
      transformer.transform(validBpmnDefinition, (err, bpmnObject, context) => {
        if (err) return done(err);
        validation.validate(bpmnObject, context, done);
      });
    });

    lab.test('but not without id', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process isExecutable="true" />
</definitions>`;

      transformer.transform(bpmnXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.be.an.error(/"id" is required/);
          done();
        });
      });
    });

    lab.test('or without flowElements', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true" />
</definitions>`;

      transformer.transform(bpmnXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.be.an.error(/"flowElements" is required/);
          done();
        });
      });
    });

    lab.test('or with a flowElement without id', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent />
  </process>
</definitions>`;

      transformer.transform(bpmnXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.be.an.error(/"id" is required/);
          done();
        });
      });
    });
  });

  lab.experiment('sequence flows', () => {
    lab.test('targetRef is required', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" />
  </process>
</definitions>`;

      transformer.transform(processXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.be.an.error(/"targetRef" is required/);
          done();
        });
      });
    });

    lab.test('sourceRef is required', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <endEvent id="end" />
    <sequenceFlow id="flow2" targetRef="end" />
  </process>
</definitions>`;

      transformer.transform(processXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.be.an.error(/"sourceRef" is required/);
          done();
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

      transformer.transform(processXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.exist();
          done();
        });
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

      transformer.transform(processXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.exist();
          done();
        });
      });
    });

    lab.test('should support exclusiveGateway with default flow', (done) => {

      // if there multiple outgoing sequence flows without conditions, an exception is thrown at deploy time,
      // even if one of them is the default flow

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow3" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2" />
  </process>
</definitions>`;

      transformer.transform(processXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);

        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.not.exist();
          done();
        });
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

      transformer.transform(processXml, (terr, bpmnObject, context) => {
        if (terr) return done(terr);
        validation.validate(bpmnObject, context, (err) => {
          expect(err).to.not.exist();
          done();
        });
      });
    });

  });
});
