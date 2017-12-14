'use strict';

const testHelpers = require('../helpers/testHelpers');

describe('BoundaryEvent', () => {
  describe('behaviour', () => {
    it('without event definition starts but only leaves', async () => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="service" />
          <boundaryEvent id="emptyEvent" attachedToRef="service" />
        </process>
      </definitions>`;

      const context = await testHelpers.context(source);

      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('emptyEvent');

      const wait = new Promise((resolve) => {
        event.on('leave', resolve);
      });

      event.activate();
      task.run();

      return wait;
    });

    it('does not listen to attached to', async () => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="service" implementation="\${services.test}" />
          <boundaryEvent id="emptyEvent" attachedToRef="service" />
        </process>
      </definitions>`;

      const context = await testHelpers.context(source);
      context.environment.addService('test', (arg, callback) => {
        return callback(new Error('Catch me'));
      });

      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('emptyEvent');

      const wait = new Promise((resolve) => {
        task.on('error', resolve);
      });

      event.activate();
      task.run();

      return wait;
    });
  });
});
