'use strict';

const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

Feature('Resume execution', () => {
  Scenario('Execution is stopped and resumed', () => {
    let engine, listener, source;
    Given('a bpmn source with a sub processes with one user task', () => {
      source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <subProcess id="inner">
            <userTask id="task" />
          </subProcess>
        </process>
      </definitions>`;
    });

    Given('an engine with source', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        settings: {
          mySetting: 1,
        },
        services: {
          serviceFn() {},
        },
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
    Then('the executing source is stopped', async () => {
      await engine.stop();

      state = await engine.getState();

      expect(state).to.have.property('state', 'stopped');
      expect(state.definitions).to.have.length(1);
      expect(state.definitions[0].source).to.be.ok;
    });

    let recovered;
    When('engine is recovered with a new setting and one overridden setting', () => {
      recovered = Engine({
        name: 'Recovered engine',
      }).recover(state, {
        settings: {
          recoverSetting: true,
          mySetting: 3,
        },
        services: {
          serviceFn() {},
        },
      });
    });

    Then('engine state is idle', () => {
      expect(recovered).to.have.property('state', 'idle');
    });

    let definition, subProcess, activity;
    But('definitions has a recovered state with new setting igoring overridden setting', async () => {
      const definitions = await recovered.getDefinitions();

      expect(recovered.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'execution environment settings');

      expect(definitions.length).to.equal(1);

      [definition] = definitions;

      expect(definition.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'definition environment settings');

      expect(definition.getProcesses()[0].environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'process environment settings');

      subProcess = definition.getActivityById('inner');
      expect(subProcess, 'sub process').to.be.ok;
      expect(subProcess.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'subProcess environment settings');

      activity = subProcess.getActivityById('task');
      expect(activity, 'user task').to.be.ok;
      expect(activity.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'userTask environment settings');

      expect(activity.environment.services).to.have.property('serviceFn').that.is.a('function');
    });

    And('user task is in executing state', () => {
      expect(definition.getActivityById('inner')).to.have.property('status', 'executing');
    });

    And('listening once for wait', () => {
      waiting = new Promise((resolve) => {
        listener.once('wait', (api) => {
          resolve(api);
        });
      });
    });

    let execution;
    When('resumed with settings', async () => {
      execution = await recovered.resume({
        listener,
        settings: {
          resumeSetting: true,
        }
      });
    });

    Then('engine is running', () => {
      expect(recovered.state).to.equal('running');
    });

    And('resumed setting is ignored since only listener is used', () => {
      const definitions = execution.definitions;

      expect(execution.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'execution environment');

      expect(execution.environment.settings).to.not.have.property('resumeSetting');

      expect(definitions.length).to.equal(1);

      [definition] = definitions;

      expect(definition.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'definition environment');

      expect(definition.getProcesses()[0].environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'process environment');

      subProcess = definition.getActivityById('inner');
      expect(subProcess, 'sub process').to.be.ok;
      expect(subProcess.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'subProcess environment');

      activity = subProcess.getActivityById('task');
      expect(activity, 'user task').to.be.ok;
      expect(activity.environment.settings).to.contain({
        mySetting: 1,
        recoverSetting: true,
      }, 'userTask environment');
    });

    When('task is signaled', async () => {
      const api = await waiting;
      api.signal();
    });

    Then('execution completes', () => {
      expect(recovered).to.have.property('state', 'idle');
    });

    let slimmerState;
    Given('state definition source is deleted', () => {
      slimmerState = JSON.parse(JSON.stringify(state));
      slimmerState.definitions[0].source = undefined;
    });

    When('engine is recovered with a the slimmer state and sourceContext', async () => {
      recovered = Engine({
        sourceContext: await testHelpers.context(source),
      }).recover(slimmerState);
    });

    Then('engine can be resumed', async () => {
      execution = await recovered.resume();
      expect(execution.getPostponed()).to.have.length(1);
    });

    When('sourceContext is added to engine before resume', async () => {
      recovered = Engine();

      recovered.addSource({
        sourceContext: await testHelpers.context(source),
      });

      recovered.recover(slimmerState);
    });

    Then('engine can be resumed with added source', async () => {
      execution = await recovered.resume();
      expect(execution.getPostponed()).to.have.length(1);
    });

    When('engine is recovered with some sourceContext not matching definition id', async () => {
      const otherSource = `
      <definitions id="Def_2" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <subProcess id="inner">
            <userTask id="task" />
          </subProcess>
        </process>
      </definitions>`;

      recovered = Engine({
        name: 'Recovered engine',
        sourceContext: await testHelpers.context(otherSource),
      });
    });

    Then('engine can be resumed', () => {
      expect(() => {
        recovered.recover(slimmerState);
      }).to.throw(Error);
    });
  });
});
