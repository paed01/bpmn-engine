'use strict';

const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('IntermediateCatchEvent with message', () => {
  describe('behaviour', () => {
    let context;
    beforeEach((done) => {
      const source = factory.resource('lanes.bpmn').toString();
      testHelpers.getContext(source, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    it('inbound does not contain message flow', (done) => {
      const event = context.getChildActivityById('intermediate');
      expect(event.inbound.length).to.equal(1);
      expect(event.inbound[0].type).to.equal('bpmn:SequenceFlow');
      done();
    });
  });

});
