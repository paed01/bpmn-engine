import { EventEmitter } from 'node:events';
import * as testHelpers from '../helpers/testHelpers.js';
import { Engine } from 'bpmn-engine';

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
      engine = new Engine({
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
      engine.execute({ listener });
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
      recovered = new Engine({
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

      expect(recovered.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'execution environment settings'
      );

      expect(definitions.length).to.equal(1);

      [definition] = definitions;

      expect(definition.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'definition environment settings'
      );

      expect(definition.getProcesses()[0].environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'process environment settings'
      );

      subProcess = definition.getActivityById('inner');
      expect(subProcess, 'sub process').to.be.ok;
      expect(subProcess.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'subProcess environment settings'
      );

      activity = subProcess.getActivityById('task');
      expect(activity, 'user task').to.be.ok;
      expect(activity.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'userTask environment settings'
      );

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
        },
      });
    });

    Then('engine is running', () => {
      expect(recovered.state).to.equal('running');
    });

    And('resumed setting is ignored since only listener is used', () => {
      const definitions = execution.definitions;

      expect(execution.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'execution environment'
      );

      expect(execution.environment.settings).to.not.have.property('resumeSetting');

      expect(definitions.length).to.equal(1);

      [definition] = definitions;

      expect(definition.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'definition environment'
      );

      expect(definition.getProcesses()[0].environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'process environment'
      );

      subProcess = definition.getActivityById('inner');
      expect(subProcess, 'sub process').to.be.ok;
      expect(subProcess.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'subProcess environment'
      );

      activity = subProcess.getActivityById('task');
      expect(activity, 'user task').to.be.ok;
      expect(activity.environment.settings).to.contain(
        {
          mySetting: 1,
          recoverSetting: true,
        },
        'userTask environment'
      );
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
      recovered = new Engine({
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

      recovered = new Engine({
        name: 'Recovered engine',
        sourceContext: await testHelpers.context(otherSource),
      });
    });

    Then('engine cannot be resumed', () => {
      expect(() => {
        recovered.recover(slimmerState);
      }).to.throw(Error);
    });
  });

  Scenario('recover with options', () => {
    let engine, listener, source;
    Given('a bpmn source with user task, timer and script', () => {
      source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <task id="task" />
          <sequenceFlow id="to-timer" sourceRef="task" targetRef="timer" />
          <intermediateCatchEvent id="timer">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT1S</timeDuration>
            </timerEventDefinition>
          </intermediateCatchEvent>
          <sequenceFlow id="to-script" sourceRef="timer" targetRef="script" />
          <scriptTask id="script" scriptFormat="js">
            <script>this.environment.services.serviceFn(next)</script>
          </scriptTask>
        </process>
      </definitions>`;
    });

    const events = [];
    Given('an engine with source', () => {
      listener = new EventEmitter();

      listener.on('activity.end', (api) => {
        events.push(api.id);
      });

      engine = new Engine({
        name: 'Resume feature',
        source,
        listener,
        services: {
          serviceFn(...args) {
            args.pop()();
          },
        },
      });
    });

    let execution1;
    When('engine is executed', async () => {
      execution1 = await engine.execute();
    });

    Then('timer is waiting', () => {
      expect(execution1.activityStatus).to.equal('timer');
    });

    And('attempting to recover a running engine instance throws', () => {
      expect(() => {
        engine.recover(execution1.getState(), {
          settings: {
            mySetting: 1,
          },
        });
      }).to.throw(/running/);
    });

    And('attempting to resume a running engine instance throws', async () => {
      try {
        await engine.resume();
      } catch (err) {
        // eslint-disable-next-line no-var
        var error = err;
      }
      expect(error).to.match(/running/);
    });

    And('attempting to resume a running engine instance with callback returns error in callback', (done) => {
      engine.resume((err) => {
        expect(err).to.match(/running/);
        done();
      });
    });

    Given('execution is stopped', () => {
      return execution1.stop();
    });

    let execution2;
    When('same instance is recovered with options and resumed', async () => {
      engine.recover(execution1.getState(), {
        settings: {
          mySetting: 1,
        },
      });

      execution2 = await engine.resume();
    });

    Then('first execution is stopped', () => {
      expect(execution1.state).to.equal('stopped');
    });

    And('only one timer is running', () => {
      expect(engine.environment.timers.executing).to.have.length(1);
    });

    And('a new timer is waiting', () => {
      expect(execution2.activityStatus).to.equal('timer');
    });

    let end;
    When('resumed timer times out', () => {
      end = engine.waitFor('end');
      engine.environment.timers.executing.pop().callback();
    });

    Then('run completes', () => {
      return end;
    });

    And('listener has captured events', () => {
      expect(events).to.deep.equal(['task', 'timer', 'script']);
    });

    Given('a new engine instance with same source', () => {
      events.splice(0);

      engine = new Engine({
        name: 'Proper resume',
        source,
        listener,
        services: {
          serviceFn(...args) {
            args.pop()();
          },
        },
      });
    });

    When('engine is executed', async () => {
      execution1 = await engine.execute();
    });

    Then('timer is waiting', () => {
      expect(execution1.activityStatus).to.equal('timer');
    });

    let state;
    Given('run is stopped and state is saved', async () => {
      await engine.stop();
      state = execution1.getState();
    });

    When('a new instance is recovered with listener and service options and resumed', async () => {
      engine = new Engine({
        name: 'Proper recover',
      });

      engine.recover(state, {
        listener,
        services: {
          serviceFn(...args) {
            args.pop()();
          },
        },
      });

      execution2 = await engine.resume();
    });

    Then('a timer is running', () => {
      expect(engine.environment.timers.executing).to.have.length(1);
    });

    When('recovered and resumed timer times out', () => {
      end = engine.waitFor('end');
      engine.environment.timers.executing.pop().callback();
    });

    Then('run completes', () => {
      return end;
    });

    And('listener has captured events', () => {
      expect(events).to.deep.equal(['task', 'timer', 'script']);
    });
  });
});
