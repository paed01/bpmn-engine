'use strict';

const Code = require('code');
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

  });
});

function getFlowById(context, id) {
  return context.sequenceFlows.find((f) => f.id === id);
}

