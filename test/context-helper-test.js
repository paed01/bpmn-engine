'use strict';

const Bpmn = require('..');
const Code = require('code');
const factory = require('./helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const contextHelper = require('../lib/context-helper');

lab.experiment('context-helper', () => {
  const transformer = Bpmn.Transformer;

  let context;
  lab.before((done) => {
    transformer.transform(factory.valid(), (err, bpmnObject, result) => {
      if (err) return done(err);
      context = result;
      done();
    });
  });

  lab.experiment('#getOutboundSequenceFlows', () => {
    lab.test('returns activity outbound sequence flows', (done) => {
      const flows = contextHelper.getOutboundSequenceFlows(context, 'theStart');
      expect(flows).to.have.length(1);
      done();
    });

    lab.test('empty array if non found', (done) => {
      const flows = contextHelper.getOutboundSequenceFlows(context, 'end1');
      expect(flows).to.have.length(0);
      done();
    });
  });

  lab.experiment('#getInboundSequenceFlows', () => {
    lab.test('returns activity inbound sequence flows', (done) => {
      const flows = contextHelper.getInboundSequenceFlows(context, 'end2');
      expect(flows).to.have.length(1);
      done();
    });

    lab.test('empty array if non found', (done) => {
      const flows = contextHelper.getInboundSequenceFlows(context, 'theStart');
      expect(flows).to.have.length(0);
      done();
    });
  });

  lab.experiment('#getDataObjectFromRef', () => {
    let userContext;
    lab.before((done) => {
      transformer.transform(factory.userTask(), (err, bpmnObject, result) => {
        if (err) return done(err);
        userContext = result;
        done();
      });
    });

    lab.test('returns referenced data object', (done) => {
      const dataObject = contextHelper.getDataObjectFromRef(userContext, 'inputFromUserRef');
      expect(dataObject).to.have.include('id', '$type');
      done();
    });

    lab.test('if found', (done) => {
      const dataObject = contextHelper.getDataObjectFromRef(userContext, 'orphanRef');
      expect(dataObject).to.not.exist();
      done();
    });
  });

  lab.experiment('#getDataObjectFromAssociation', () => {
    let userContext;
    lab.before((done) => {
      transformer.transform(factory.userTask(), (err, bpmnObject, result) => {
        if (err) return done(err);
        userContext = result;
        done();
      });
    });

    lab.test('returns data by association', (done) => {
      const dataObject = contextHelper.getDataObjectFromAssociation(userContext, 'associatedWith');
      expect(dataObject).to.have.include('id', '$type');
      expect(dataObject.id).to.equal('inputFromUser');
      done();
    });

    lab.test('if found', (done) => {
      const dataObject = contextHelper.getDataObjectFromAssociation(userContext, 'non-association');
      expect(dataObject).to.not.exist();
      done();
    });

    lab.test('also works if data object reference is not a reference but the actual data object', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="userTask">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUser" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

      transformer.transform(processXml, (err, bpmnObject, result) => {
        if (err) return done(err);
        const dataObject = contextHelper.getDataObjectFromAssociation(result, 'associatedWith');
        expect(dataObject).to.have.include('id', '$type');
        expect(dataObject.id).to.equal('inputFromUser');
        done();
      });
    });
  });

  lab.experiment('#isTerminationElement', () => {
    let localContext;
    lab.before((done) => {
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
      transformer.transform(processXml, (err, bpmnObject, result) => {
        if (err) return done(err);
        localContext = result;
        done();
      });
    });

    lab.test('returns false if no element passed', (done) => {
      expect(contextHelper.isTerminationElement()).to.be.false();
      done();
    });

    lab.test('returns false if no element eventDefinitions', (done) => {
      expect(contextHelper.isTerminationElement({})).to.be.false();
      done();
    });
    lab.test('returns false if empty element eventDefinitions', (done) => {
      expect(contextHelper.isTerminationElement({
        eventDefinitions: []
      })).to.be.false();
      done();
    });

    lab.test('returns false if empty element eventDefinitions', (done) => {
      expect(contextHelper.isTerminationElement(localContext.elementsById.theEnd1)).to.be.false();
      done();
    });

    lab.test('returns true if element eventDefinitions contains bpmn:TerminateEventDefinition', (done) => {
      expect(contextHelper.isTerminationElement(localContext.elementsById.fatal)).to.be.true();
      done();
    });
  });
});
