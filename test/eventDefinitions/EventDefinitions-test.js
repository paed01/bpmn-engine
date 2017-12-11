'use strict';

const testHelpers = require('../helpers/testHelpers');

describe('EventDefinitions', () => {
  describe('activity with unsupported eventDefinition', () => {
    it('is ignored', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="Process_1" isExecutable="true">
          <intermediateCatchEvent id="linkCatchEvent">
            <bpmn:linkEventDefinition />
          </intermediateCatchEvent>
        </process>
      </definitions>`;

      const context = await testHelpers.context(source);
      const activity = context.getChildActivityById('linkCatchEvent');
      expect(activity).to.be.ok;

      expect(activity.getEventDefinitions()).to.have.length(0);
    });
  });
});
