'use strict';

const testHelpers = require('../helpers/testHelpers.js');
const {Engine} = require('../../src/index.js');

Feature('Shake', () => {
  Scenario('Determine run sequences for an activity', () => {
    let engine, source;
    Given('a bpmn source with user tasks', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <userTask id="task1" camunda:formKey="taskForm" />
          <sequenceFlow id="flow" sourceRef="task1" targetRef="task2" />
          <userTask id="task2" />
        </process>
      </definitions>`;
    });

    let definition;
    And('an engine loaded with extension for fetching form and saving output', async () => {
      engine = Engine({
        name: 'Shake feature',
        sourceContext: await testHelpers.context(source),
      });

      [definition] = await engine.getDefinitions();
    });

    let result;
    When('start task is shaken', () => {
      result = definition.shake('task1');
    });

    Then('run sequences are determined', () => {
      expect(result).to.have.property('task1').with.length(1);
      expect(result.task1[0]).to.have.property('sequence').with.length(3);
    });
  });
});
