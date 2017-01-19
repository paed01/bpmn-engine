'use strict';

const Code = require('code');
const Bpmn = require('..');
const Lab = require('lab');

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

lab.experiment('transformer', () => {
  const transformer = Bpmn.transformer;

  lab.test('returns Bpmn object and context in callback', (done) => {
    transformer.transform(validBpmnDefinition, {}, done);
  });

  lab.test('unless null input', (done) => {
    transformer.transform(null, {}, (err) => {
      expect(err).to.exist();
      done();
    });
  });

  lab.test('or empty string', (done) => {
    transformer.transform('', {}, (err) => {
      expect(err).to.exist();
      done();
    });
  });

  lab.test('or not a string', (done) => {
    transformer.transform({}, {}, (err) => {
      expect(err).to.exist();
      done();
    });
  });

  lab.describe('additional packages', () => {
    lab.test('camunda', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
  </process>
</definitions>`;

      transformer.transform(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, moddle, context) => {
        if (err) return done(err);
        expect(context.elementsById.serviceTask).to.include({expression: '\${services.get}'});
        done();
      });
    });
  });
});
