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
});
