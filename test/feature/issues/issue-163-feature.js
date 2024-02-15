import { Engine } from '../../../src/index.js';
import * as factory from '../../helpers/factory.js';

Feature('issue 163', () => {
  Scenario('Get sub process postponed', () => {
    let engine, execution;
    When('one usertask and two user tasks in sub process and finally a user task', async () => {
      const source = factory.resource('issue-163.bpmn');

      engine = Engine({
        source,
      });

      execution = await engine.execute();
    });

    let postponed;
    Then('execution waits for both first user task', () => {
      postponed = execution.getPostponed();
      expect(postponed).to.have.length(1);
      expect(postponed.find(({ type }) => type === 'bpmn:UserTask')).to.be.ok;
    });

    When('first user task is signaled', () => {
      execution.signal({ id: postponed[0].id });
    });

    Then('execution has started sub process', () => {
      postponed = execution.getPostponed();
      expect(postponed).to.have.length(1);
      expect(postponed.find(({ type }) => type === 'bpmn:SubProcess')).to.be.ok;
    });

    let subPostponed;
    And('first user task in sub process is waiting to be signaled', () => {
      subPostponed = postponed[0].getPostponed();
      expect(subPostponed).to.have.length(2);
      expect(subPostponed.find(({ type }) => type === 'bpmn:UserTask')).to.be.ok;
    });

    When('first subprocess user task is signaled', () => {
      execution.signal({ id: subPostponed.find(({ type }) => type === 'bpmn:UserTask').id });
    });

    Then('execution is still waiting for sub process', () => {
      postponed = execution.getPostponed();
      expect(postponed).to.have.length(1);
      expect(postponed.find(({ type }) => type === 'bpmn:SubProcess')).to.be.ok;
    });

    And('second user task in sub process is waiting to be signaled', () => {
      subPostponed = postponed[0].getPostponed();
      expect(subPostponed).to.have.length(2);
      expect(subPostponed.find(({ type }) => type === 'bpmn:UserTask')).to.be.ok;
    });

    When('second subprocess user task is signaled', () => {
      execution.signal({ id: subPostponed.find(({ type }) => type === 'bpmn:UserTask').id });
    });

    Then('execution is waiting for final user task', () => {
      postponed = execution.getPostponed();
      expect(postponed).to.have.length(1);
      expect(postponed.find(({ type }) => type === 'bpmn:UserTask')).to.be.ok;
    });

    let ended;
    When('final user task is signaled', () => {
      ended = engine.waitFor('end');
      execution.signal({ id: postponed[0].id });
    });

    Then('execution completes', () => {
      return ended;
    });
  });
});
