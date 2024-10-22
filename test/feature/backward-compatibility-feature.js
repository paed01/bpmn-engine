import { EventEmitter } from 'node:events';
import { Engine } from '../../src/index.js';

Feature('Backward compatability', () => {
  Scenario('Version 13 state without process environment', () => {
    let engine, listener;
    Given('a bpmn source that access environment variables', () => {
      const source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="start" scriptFormat="javascript">
            <script>
              environment.output.startVars = { foo: 'bar' };
              next();
            </script>
          </scriptTask>
          <sequenceFlow id="to-task" sourceRef="start" targetRef="task" />
          <userTask id="task" />
          <sequenceFlow id="to-end" sourceRef="task" targetRef="end" />
          <scriptTask id="end" scriptFormat="javascript">
            <script>
              environment.output.result = {
                foo: environment.output.startVars.foo,
                bar: environment.settings.mySettings.bar,
                fields: environment.variables.fields.routingKey,
                content: environment.variables.content.id,
                properties: environment.variables.properties.messageId,
              };
              next();
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      engine = Engine({
        name: 'Engine feature',
        source,
        settings: {
          mySettings: { bar: 'baz' },
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
      engine.execute({ listener });
    });

    And('user task is in a waiting state', async () => {
      await waiting;
    });

    let state;
    Then('process state is saved without environment', async () => {
      await engine.stop();

      state = await engine.getState();

      expect(state).to.have.property('state', 'stopped');
      expect(state.definitions).to.have.length(1);
      expect(state.definitions[0].source).to.be.ok;
      expect(state.definitions[0].execution.processes[0]).to.be.ok;
    });

    Given('in version 13 and below process state environment output is shared with definition', () => {
      state.engineVersion = '13.0.0';
      state.definitions[0].environment.output = state.definitions[0].execution.processes[0].environment.output;
    });

    And('process state environment is not present', () => {
      delete state.definitions[0].execution.processes[0].environment;
    });

    let recovered;
    When('engine is recovered with old state in latest version', () => {
      const upgradedState = upgradeStateToVersion14(state);
      recovered = Engine({
        name: 'Recovered engine',
      }).recover(upgradedState);
    });

    let execution;
    And('resumed', async () => {
      execution = await recovered.resume();
    });

    let ended;
    And('user task is signaled', () => {
      ended = recovered.waitFor('end');

      execution.signal({ id: 'task' });
    });

    Then('run completes', async () => {
      await ended;
      expect(execution.environment.output.result).to.deep.include({
        foo: 'bar',
        bar: 'baz',
        fields: 'run.execute',
        content: 'theProcess',
      });
      expect(execution.environment.output.result).to.have.property('properties');
    });
  });
});

function upgradeStateToVersion14(state) {
  const stateVersion = getSemverVersion(state.engineVersion);
  if (!stateVersion || stateVersion.major >= 14) return state;

  return polyfillProcessEnvironment(state);
}

function polyfillProcessEnvironment(state) {
  if (!state.definitions?.length) return state;

  const polyfilledState = JSON.parse(JSON.stringify(state));
  for (const definition of polyfilledState.definitions) {
    if (!definition.environment) continue;
    if (!definition.execution) continue;
    if (!definition.execution.processes) continue;

    for (const bp of definition.execution.processes) {
      addProcessEnvironment(definition.environment, bp);
    }
  }

  return polyfilledState;
}

function addProcessEnvironment(environment, processState) {
  processState.environment = JSON.parse(JSON.stringify(environment));
}

function getSemverVersion(version) {
  if (typeof version !== 'string') return;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return;
  const [, major, minor, patch] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}
