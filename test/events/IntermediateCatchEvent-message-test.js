'use strict';

const factory = require('../helpers/factory');
const testHelpers = require('../helpers/testHelpers');

describe('IntermediateCatchEvent with message', () => {
  describe('behaviour', () => {
    let context;
    beforeEach(async () => {
      context = await testHelpers.context(factory.resource('lanes.bpmn').toString());
    });

    it('inbound does not contain message flow', (done) => {
      const event = context.getChildActivityById('intermediate');
      expect(event.inbound.length).to.equal(1);
      expect(event.inbound[0].type).to.equal('bpmn:SequenceFlow');
      done();
    });
  });

});
