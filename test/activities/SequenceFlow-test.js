'use strict';

const Bpmn = require('../..');
const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');
const SequenceFlow = require('../../lib/mapper')('bpmn:SequenceFlow');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('SequenceFlow', () => {
  let context;
  lab.before((done) => {
    testHelper.getContext(factory.resource('loop.bpmn').toString(), (err, newContext) => {
      if (err) return done(err);
      context = newContext;
      expect(context.sequenceFlows.length).to.be.above(0);
      done();
    });
  });

  lab.describe('ctor', () => {
    lab.test('sets source and target id', (done) => {
      context.sequenceFlows.forEach((f) => {
        expect(f.targetId).to.exist();
        expect(f.sourceId).to.exist();
      });
      done();
    });

    lab.test('loads conditional flow condition', (done) => {
      const flow = getFlowById(context, 'flow3');
      expect(flow.condition).to.exist();
      done();
    });

    lab.test('loads unconditional flow', (done) => {
      const flow = getFlowById(context, 'flow1');
      expect(flow.condition).to.not.exist();
      done();
    });
  });

  lab.describe('condition', () => {
    lab.test('throws if type is not JavaScript', (done) => {
      const activity = {
        element: {
          id: 'flow',
          $type: 'bpmn:SequenceFlow',
          conditionExpression: {
            language: 'Java'
          }
        }
      };

      function test() {
        new SequenceFlow(activity); // eslint-disable-line no-new
      }

      expect(test).to.throw(Error, /Java is unsupported/i);
      done();
    });

    lab.test('throws if type is undefined', (done) => {
      const activity = {
        element: {
          id: 'flow',
          $type: 'bpmn:SequenceFlow',
          conditionExpression: {}
        }
      };

      function test() {
        new SequenceFlow(activity); // eslint-disable-line no-new
      }

      expect(test).to.throw(Error, /undefined is unsupported/i);
      done();
    });


    lab.test('condition cannot alter variables (or at least shallow)', (done) => {
      const sourceXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess1" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
        this.variables.input = 1;
        this.variables.input < 2
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
    `;

      const engine = new Bpmn.Engine({
        source: sourceXml
      });
      const listener = new EventEmitter();

      listener.on('taken-flow3', (flow) => {
        Code.fail(`<${flow.id}> should not have been taken`);
      });

      engine.execute({
        listener: listener,
        variables: {
          input: 3
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          done();
        });
      });
    });
  });
});

function getFlowById(context, id) {
  return context.sequenceFlows.find((f) => f.id === id);
}
