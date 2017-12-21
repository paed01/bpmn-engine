'use strict';

const {Engine} = require('../..');
const {EventEmitter} = require('events');


Feature('Engine', () => {
  Scenario('execution is stopped and resurrected', () => {

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
        listener.once('wait-task', (...args) => {
          resolve(...args);
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
      state = engine.getState();
      engine.stop();
      expect(state.state).to.equal('running');
      expect(state.definitions).to.have.length(1);
    });

    let resurrected;
    When('engine is resurrected', () => {
      resurrected = Engine.resurrect(state, {listener});
    });

    Then('engine state is still idle', () => {
      expect(resurrected.getState()).to.have.property('name', 'Engine feature');
      expect(resurrected.getState()).to.have.property('state', 'idle');
    });

    let definition;
    But('definitions has a resumed state', () => {
      expect(resurrected.definitions.length).to.equal(1);

      [definition] = resurrected.definitions;
      expect(definition.getChildActivityById('task')).to.be.ok;
    });

    And('user task is in a waiting state', () => {
      console.log(definition.getPendingActivities())
      expect(definition.getChildActivityById('task').getState()).to.have.property('waiting', true);
    });
  });
});
