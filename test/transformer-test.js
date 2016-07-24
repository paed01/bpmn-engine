'use strict';

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const expect = Code.expect;

const fs = require('fs');
const Bpmn = require('..');

lab.describe('transformer', () => {
  lab.describe('#transform', () => {
    const transformer = new Bpmn.Transformer();

    const bpmnSchema = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" name="The Process" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />
  </process>
</definitions>
`;

    lab.it('returns transformed BPMN-schema', (done) => {
      transformer.transform(bpmnSchema, true, (err, definition) => {
        if (err) return done(err);

        expect(definition).to.exist();
        expect(definition.rootElements).to.exist();
        expect(definition.rootElements).to.have.length(1);

        expect(definition.rootElements[0].name).to.equal('The Process');

        done();
      });
    });

    lab.it('without attributes on processelement returns no id for process', (done) => {
      const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process></process>
</definitions>
        `;

      transformer.transform(xml, true, (err, definition) => {
        if (err) return done(err);
        expect(definition.rootElements[0].name).to.not.exist();
        done();
      });
    });

    lab.it('exclusive gateway with outgoing sequence flows without conditions returns error in callback', (done) => {
      const xml = fs.readFileSync('./test/resources/defaultFlow.bpmn').toString();
      transformer.transform(xml, true, (err) => {
        expect(err, 'No error').to.exist();
        done();
      });
    });
  });
});
