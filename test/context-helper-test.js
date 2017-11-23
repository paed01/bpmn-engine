'use strict';

const {transformer} = require('..');
const ContextHelper = require('../lib/context-helper');
const factory = require('./helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const {before, beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('context-helper', () => {
  let context;
  beforeEach((done) => {
    transformer.transform(factory.valid(), {}, (err, bpmnObject, result) => {
      if (err) return done(err);
      context = ContextHelper(result);
      done();
    });
  });

  describe('getOutboundSequenceFlows()', () => {
    it('returns activity outbound sequence flows', (done) => {
      const flows = context.getOutboundSequenceFlows('theStart');
      expect(flows).to.have.length(1);
      done();
    });

    it('empty array if non found', (done) => {
      const flows = context.getOutboundSequenceFlows('end1');
      expect(flows).to.have.length(0);
      done();
    });
  });

  describe('getInboundSequenceFlows()', () => {
    it('returns activity inbound sequence flows', (done) => {
      const flows = context.getInboundSequenceFlows('end2');
      expect(flows).to.have.length(1);
      done();
    });

    it('empty array if non found', (done) => {
      const flows = context.getInboundSequenceFlows('theStart');
      expect(flows).to.have.length(0);
      done();
    });

    it('returns inbound for sub process', (done) => {
      const processXml = factory.resource('sub-process.bpmn');
      transformer.transform(processXml.toString(), {}, (err, bpmnObject, moddleContext) => {
        if (err) return done(err);

        const flows = ContextHelper(moddleContext).getInboundSequenceFlows('subProcess');
        expect(flows).to.have.length(1);

        done();
      });
    });

    it('returns no inbound for main process', (done) => {
      const processXml = factory.resource('sub-process.bpmn');
      transformer.transform(processXml.toString(), {}, (err, bpmnObject, moddleContext) => {
        if (err) return done(err);

        const flows = ContextHelper(moddleContext).getInboundSequenceFlows('mainProcess');
        expect(flows).to.have.length(0);

        done();
      });
    });

  });

  describe('hasInboundSequenceFlows()', () => {
    it('returns false if no inbound sequenceFlows', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
        </process>
      </definitions>`;
      transformer.transform(processXml, {}, (err, bpmnObject, result) => {
        if (err) return done(err);
        expect(ContextHelper(result).hasInboundSequenceFlows('theStart')).to.be.false();
        done();
      });
    });

    it('returns true if inbound sequenceFlows', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <endEvent id="theEnd" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd" />
        </process>
      </definitions>`;
      transformer.transform(processXml, {}, (err, bpmnObject, result) => {
        if (err) return done(err);
        expect(ContextHelper(result).hasInboundSequenceFlows('theEnd')).to.be.true();
        done();
      });
    });

    it('returns false if no sequenceFlows', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <endEvent id="theEnd" />
        </process>
      </definitions>`;
      transformer.transform(processXml, {}, (err, bpmnObject, result) => {
        if (err) return done(err);
        expect(ContextHelper(result).hasInboundSequenceFlows('theEnd')).to.be.false();
        done();
      });
    });
  });

  describe('getActivities()', () => {
    it('returns only activities bound to element', (done) => {
      const processXml = factory.resource('sub-process.bpmn');
      transformer.transform(processXml.toString(), {}, (err, bpmnObject, moddleContext) => {
        if (err) return done(err);

        const ctxHelper = ContextHelper(moddleContext);

        const forParent = ctxHelper.getActivities('mainProcess');
        expect(forParent).to.have.length(3);

        const forSubprocess = ctxHelper.getActivities('subProcess');

        expect(forSubprocess).to.have.length(2);

        done();
      });
    });
  });

  describe('getSequenceFlowTargetId()', () => {

    it('returns target id', (done) => {
      expect(context.getSequenceFlowTargetId('flow1')).to.equal('decision');
      done();
    });

    it('if found', (done) => {
      expect(context.getSequenceFlowTargetId('nonFoundFlow1')).to.not.exist();
      done();
    });
  });

  describe('io', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="inputToUserRef" dataObjectRef="userInfo" />
        <dataObjectReference id="globalRef" dataObjectRef="global" />
        <dataObject id="userInfo" />
        <dataObject id="global" />
        <dataObject id="noref" />
        <userTask id="userTask">
          <ioSpecification id="inputSpec">
            <dataInput id="userInput" name="info" />
          </ioSpecification>
          <dataInputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputToUserRef" />
        </userTask>
      </process>
    </definitions>`;

    let contextHelper;
    before((done) => {
      transformer.transform(source, {}, (err, bpmnObject, result) => {
        if (err) return done(err);
        contextHelper = ContextHelper(result);
        done();
      });
    });

    it('getDataObjects() returns dataObjects that have references', (done) => {
      const data = contextHelper.getDataObjects();
      expect(data.length).to.equal(2);
      expect(data[0].id).to.equal('userInfo');
      expect(data[1].id).to.equal('global');
      done();
    });

    it('getDataObjectReferences() returns associations and data object references', (done) => {
      const data = contextHelper.getDataObjectReferences();
      expect(data.dataInputAssociations.length).to.equal(2);
      expect(data.dataOutputAssociations.length).to.equal(0);
      expect(data.dataObjectRefs.length).to.equal(2);

      done();
    });
  });
});
