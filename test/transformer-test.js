'use strict';

const {transformer} = require('..');

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

describe('transformer', () => {
  it('returns Bpmn object and context in callback', (done) => {
    transformer.transform(validBpmnDefinition, {}, done);
  });

  it('unless null input', (done) => {
    transformer.transform(null, {}, (err) => {
      expect(err).to.be.an('error');
      done();
    });
  });

  it('or empty string', (done) => {
    transformer.transform('', {}, (err) => {
      expect(err).to.be.an('error');
      done();
    });
  });

  it('or not a string', (done) => {
    transformer.transform({}, {}, (err) => {
      expect(err).to.be.an('error');
      done();
    });
  });

  describe('extensions', () => {
    it('supports camunda', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
        </process>
      </definitions>`;

      transformer.transform(source, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, moddle, context) => {
        if (err) return done(err);
        expect(context.elementsById.serviceTask).to.include({expression: '${services.get}'});
        done();
      });
    });
  });
});
