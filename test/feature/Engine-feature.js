'use strict';

const {Engine} = require('../..');
const {EventEmitter} = require('events');

Feature('Engine', () => {
  Scenario('execution is stopped and recovered', () => {
    let engine, listener, source;
    Given('a bpmn source with one user task', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <userTask id="task" />
        </process>
      </definitions>`;
    });

    Given('an engine with source', () => {
      engine = Engine({
        name: 'Engine feature',
        source
      });
    });

    And('a listener', () => {
      listener = new EventEmitter();
    });

    let waiting;
    And('listening once for wait', () => {
      waiting = new Promise((resolve) => {
        listener.once('wait', (api) => {
          resolve(api);
        });
      });
    });

    When('source is executed', () => {
      engine.execute({listener});
    });

    And('user task is in a waiting state', async () => {
      await waiting;
    });

    let state;
    Then('the executing source is stopped', () => {
      engine.stop();
      state = engine.getState();

      expect(state.state).to.equal('idle');
      expect(state.definitions).to.have.length(1);
      expect(state.definitions[0].source).to.be.ok;
    });

    let recovered;
    When('engine is recovered', () => {
      recovered = Engine({
        name: 'Recovered engine',
      }).recover(state);
    });

    Then('engine state is still idle', () => {
      expect(recovered.getState()).to.have.property('state', 'idle');
    });

    let definition;
    But('definitions has a resumed state', () => {
      expect(recovered.definitions.length).to.equal(1);

      [definition] = recovered.definitions;
      expect(definition.getActivityById('task')).to.be.ok;
    });

    And('user task is in executing state', () => {
      expect(definition.getActivityById('task')).to.have.property('status', 'executing');
    });

    And('listening once for wait', () => {
      waiting = new Promise((resolve) => {
        listener.once('wait', (api) => {
          resolve(api);
        });
      });
    });

    When('resumed', () => {
      recovered.resume({listener});
    });

    And('task is signaled', async () => {
      const api = await waiting;
      api.signal();
    });

    Then('execution completes', async () => {
      expect(recovered).to.have.property('state', 'idle');
    });
  });
});
