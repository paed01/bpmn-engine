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

  describe('getDataObjectFromRef()', () => {
    let ctxHelper;
    before((done) => {
      transformer.transform(factory.userTask(), {}, (err, bpmnObject, result) => {
        if (err) return done(err);
        ctxHelper = ContextHelper(result);
        done();
      });
    });

    it('returns referenced data object', (done) => {
      const dataObject = ctxHelper.getDataObjectFromRef('inputFromUserRef');
      expect(dataObject).to.include(['id', '$type']);
      done();
    });

    it('if found', (done) => {
      const dataObject = ctxHelper.getDataObjectFromRef('orphanRef');
      expect(dataObject).to.not.exist();
      done();
    });
  });

  describe('isTerminationElement()', () => {
    let ctxHelper, moddleContext;
    before((done) => {
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
      transformer.transform(processXml, {}, (err, bpmnObject, result) => {
        if (err) return done(err);
        moddleContext = result;
        ctxHelper = ContextHelper(result);
        done();
      });
    });

    it('returns false if no element passed', (done) => {
      expect(ctxHelper.isTerminationElement()).to.be.false();
      done();
    });

    it('returns false if no element eventDefinitions', (done) => {
      expect(ctxHelper.isTerminationElement({})).to.be.false();
      done();
    });
    it('returns false if empty element eventDefinitions', (done) => {
      expect(ctxHelper.isTerminationElement({
        eventDefinitions: []
      })).to.be.false();
      done();
    });

    it('returns false if empty element eventDefinitions', (done) => {
      expect(ctxHelper.isTerminationElement(moddleContext.elementsById.theEnd1)).to.be.false();
      done();
    });

    it('returns true if element eventDefinitions contains bpmn:TerminateEventDefinition', (done) => {
      expect(ctxHelper.isTerminationElement(moddleContext.elementsById.fatal)).to.be.true();
      done();
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

  describe('getElementService()', () => {
    it('returns connector', (done) => {
      const element = {
        $type: 'bpmn:ServiceTask',
        id: 'serviceTask',
        name: 'Post message',
        extensionElements: {
          $type: 'bpmn:ExtensionElements',
          values: [{
            $type: 'camunda:properties',
            $children: [{
              $type: 'camunda:property',
              name: 'service',
              value: 'propertyPostMessage'
            }]
          }, {
            $type: 'camunda:Connector',
            connectorId: 'postMessage'
          }]
        }
      };

      expect(context.getElementService(element)).to.equal({
        connector: {
          $type: 'camunda:Connector',
          connectorId: 'postMessage'
        }
      });
      done();
    });

    it('returns service name from properties named service', (done) => {
      const element = {
        $type: 'bpmn:ServiceTask',
        id: 'serviceTask',
        name: 'Post message',
        extensionElements: {
          $type: 'bpmn:ExtensionElements',
          values: [{
            $type: 'camunda:properties',
            $children: [{
              $type: 'camunda:property',
              name: 'service',
              value: 'postMessage'
            }, {
              $type: 'camunda:property',
              name: 'message',
              value: 'me'
            }]
          }]
        }
      };

      expect(context.getElementService(element)).to.equal({
        name: 'postMessage'
      });
      done();
    });

    it('no extensionElements no service', (done) => {
      const element = {
        $type: 'bpmn:ServiceTask',
        id: 'serviceTask',
        name: 'Post message',
        extensionElements: {
          $type: 'bpmn:ExtensionElements',
          values: []
        }
      };

      expect(context.getElementService(element)).to.be.undefined();
      done();
    });

    it('returns nothing if property named service is not found', (done) => {
      const element = {
        $type: 'bpmn:ServiceTask',
        id: 'serviceTask',
        name: 'Post message',
        extensionElements: {
          $type: 'bpmn:ExtensionElements',
          values: [{
            $type: 'camunda:properties',
            $children: [{
              $type: 'camunda:property',
              name: 'message',
              value: 'hello world'
            }]
          }]
        }
      };

      expect(context.getElementService(element)).to.not.exist();
      done();
    });

    it('without element returns undefined', (done) => {
      expect(context.getElementService()).to.be.undefined();
      done();
    });

    it('without element extensionElements returns undefined', (done) => {
      expect(context.getElementService({})).to.be.undefined();
      done();
    });
  });

  describe('getActivityErrorEventDefinition()', () => {
    it('returns nothing if no activity', (done) => {
      expect(context.getActivityErrorEventDefinition()).to.be.undefined();
      expect(context.getActivityErrorEventDefinition({})).to.be.undefined();
      done();
    });
  });

  describe('getActivityProperties()', () => {
    it('returns nothing if activity is not found', (done) => {
      expect(context.getActivityProperties('not-an-activity')).to.be.undefined();
      done();
    });
  });
});
