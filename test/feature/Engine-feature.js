'use strict';

const factory = require('../helpers/factory');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

Feature('Engine', () => {
  Scenario('Mother of all', () => {
    let engine, source;
    Given('a massive source with user task, sub process, lanes, and a loop back', () => {
      source = factory.resource('mother-of-all.bpmn');
    });

    And('an engine with preset settings and variables', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        settings: {
          enableDummyService: true,
          someSetting: 'preset',
        },
        variables: {
          someVar: 1,
        },
        services: {
          serviceFn(...args) {
            args.pop()();
          }
        }
      });
    });

    let api;
    When('source is executed with new settings and variables', async () => {
      api = await engine.execute({
        settings: {
          enableDummyService: false,
          defSetting: 'in',
        },
        variables: {
          defVar: 2,
        },
      });
    });

    Then('definitions has preset settings and variables', () => {
      for (const def of api.definitions) {
        expect(def.environment.settings).to.have.property('someSetting', 'preset');
        expect(def.environment.settings).to.have.property('defSetting', 'in');
        expect(def.environment.settings).to.have.property('enableDummyService', false);
        expect(def.environment.variables).to.have.property('someVar', 1);
        expect(def.environment.variables).to.have.property('defVar', 2);
      }
    });

    And('engine has postponed activities', () => {
      expect(api.getPostponed()).to.have.length(1);
    });

    let task;
    And('the first is an user task', () => {
      [task] = api.getPostponed();
      expect(task).to.have.property('id', 'userTask1');
      expect(task).to.have.property('type', 'bpmn:UserTask');
    });

    When('task is signaled', () => {
      task.signal(1);
    });

    Then('new postponed activities can be fetched', () => {
      expect(api.getPostponed()).to.have.length(1);
    });

    let subProcess;
    And('the second is a sub process with timeout event', () => {
      [subProcess] = api.getPostponed();
      expect(subProcess).to.have.property('type', 'bpmn:SubProcess');
    });

    When('timeout occur', () => {
      return subProcess.owner.waitFor('leave');
    });

    Then('the definition loops back to the first user task again', () => {
      [task] = api.getPostponed();
      expect(task).to.have.property('id', 'userTask1');
      expect(task).to.have.property('type', 'bpmn:UserTask');
    });

    When('task is signaled again', () => {
      task.signal(2);
    });

    And('sub process with timeout times out again', () => {
      [subProcess] = api.getPostponed();
      expect(subProcess).to.have.property('type', 'bpmn:SubProcess');
      return subProcess.owner.waitFor('leave');
    });

    Then('engine completes run', () => {
      expect(api.state).to.equal('idle');
    });

    And('definition have iterated completed counter', () => {
      expect(api.definitions[0]).to.have.property('counters').with.property('completed', 1);
    });

    And('definition processes have iterated completed counter', () => {
      const processes = api.definitions[0].getProcesses();
      expect(processes).to.have.length(2);
      expect(processes[0]).to.have.property('counters').with.property('completed', 1);
      expect(processes[1]).to.have.property('counters').with.property('completed', 1);
    });
  });

  Scenario('Execution is stopped and resumed', () => {
    let engine, listener, source;
    Given('a bpmn source with a sub processes with one user task', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
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

    Then('engine state is idle', async () => {
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
    When('resumed with a new setting', async () => {
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

    And('resumed setting is ignored', async () => {
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
  });

  Scenario('A definition with lanes', () => {
    let engine, source;
    Given('a bpmn source with two lanes with message flows', () => {
      source = factory.resource('lanes.bpmn');
    });

    And('an engine', () => {
      engine = Engine({
        name: 'Engine lanes',
        source
      });
    });

    let listener;
    const starts = [];
    And('listening for process starts', () => {
      listener = new EventEmitter();
      listener.on('process.start', (msg) => {
        starts.push(msg);
      });
    });

    let end;
    When('source is executed', () => {
      end = engine.waitFor('end');
      return engine.execute({listener});
    });

    let endApi;
    Then('both lanes have started', async () => {
      endApi = await end;
      expect(starts).to.have.length(2);
    });

    And('completed', () => {
      const [bp1, bp2] = endApi.definitions[0].getProcesses();
      expect(bp1).to.have.property('isRunning', false);
      expect(bp2).to.have.property('isRunning', false);
    });
  });

  Scenario('Activity extension', () => {
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

    And('an engine loaded with extension for fetching form and saving output', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        },
        extensions: {
          fetchForm(activity) {
            if (!activity.behaviour.formKey) return;

            const endRoutingKey = 'run.form.end';

            activity.on('enter', () => {
              activity.broker.publish('format', 'run.form.start', {endRoutingKey});

              getForm(activity).then((form) => {
                activity.broker.publish('format', endRoutingKey, {form});
              });
            });
          },
          saveToEnvironmentOutput(activity, {environment}) {
            activity.on('end', (api) => {
              environment.output[api.id] = api.content.output;
            });
          }
        }
      });

      function getForm(activity) {
        return new Promise((resolve) => {
          return resolve({
            id: activity.behaviour.formKey,
            fields: {
              surname: ''
            },
          });
        });
      }
    });

    let api;
    When('source is executed', async () => {
      api = await engine.execute();
    });

    Then('engine has postponed activities', () => {
      expect(api.getPostponed()).to.have.length(1);
    });

    let task;
    And('the first is a user task with form input fields', () => {
      [task] = api.getPostponed();
      expect(task).to.have.property('id', 'task1');
      expect(task).to.have.property('type', 'bpmn:UserTask');
      expect(task.content).to.have.property('form').with.property('id', 'taskForm');
    });

    When('task is signaled', () => {
      task.signal({
        surname: 'von Rosen'
      });
    });

    Then('the run stops at next user task without form', () => {
      [task] = api.getPostponed();
      expect(task).to.have.property('id', 'task2');
      expect(task).to.have.property('type', 'bpmn:UserTask');
      expect(task.content).to.not.have.property('form');
    });

    When('task is signaled', () => {
      task.signal(2);
    });

    Then('engine completes run', () => {
      expect(api.state).to.equal('idle');
    });

    And('extension have saved output in environment', () => {
      expect(engine.environment.output).to.have.property('task1').that.eql({surname: 'von Rosen'});
      expect(engine.environment.output).to.have.property('task2', 2);
    });
  });

  Scenario('Execute with callback', () => {
    let engine, source;
    Given('a massive source with user task, timeouts, and the rest', () => {
      source = factory.resource('mother-of-all.bpmn');
    });

    And('an engine', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        services: {
          serviceFn(...args) {
            args.pop()();
          }
        }
      });
    });

    let listener;
    And('expects to be signaled when waiting', () => {
      listener = new EventEmitter();
      listener.on('activity.wait', (activityApi) => {
        activityApi.signal();
      });
    });

    let callbackCalled, complete;
    When('source is executed with a callback', async () => {
      complete = engine.waitFor('end');

      callbackCalled = new Promise((resolve, reject) => {
        engine.execute({listener}, (err, endApi) => {
          if (err) return reject(err);
          resolve(endApi);
        });
      });
    });

    Then('callback is called when engine execution is completed', async () => {
      await complete;
      const api = await callbackCalled;
      expect(api).to.have.property('state', 'idle');
    });
  });

  Scenario('Resume with callback', () => {
    let engine, source;
    Given('a massive source with user task, timeouts, and the rest', () => {
      source = factory.resource('mother-of-all.bpmn');
    });

    And('an engine', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        services: {
          serviceFn(...args) {
            args.pop()();
          }
        }
      });
    });

    let listener;
    And('expects to be stopped at first user task wait', () => {
      listener = new EventEmitter();
      listener.once('activity.wait', (activityApi, engineApi) => {
        engineApi.stop();
      });
    });

    let callbackCalled, stopped;
    When('source is executed with a callback', async () => {
      stopped = engine.waitFor('stop');

      callbackCalled = new Promise((resolve, reject) => {
        engine.execute({listener}, (err, endApi) => {
          if (err) return reject(err);
          resolve(endApi);
        });
      });
    });

    Given('engine is stopped when waiting for user task', () => {
      return stopped;
    });

    Then('callback is called with stopped engine api', async () => {
      const api = await callbackCalled;
      expect(api).to.have.property('stopped', true);
    });

    Given('expects to be signaled at user task wait', () => {
      listener = new EventEmitter();
      listener.on('activity.wait', (activityApi) => {
        activityApi.signal();
      });
    });

    let ended;
    When('engine is resumed with a callback', async () => {
      ended = engine.waitFor('end');

      callbackCalled = new Promise((resolve, reject) => {
        engine.resume({listener}, (err, endApi) => {
          if (err) return reject(err);
          resolve(endApi);
        });
      });
    });

    Then('callback is called when engine execution is completed', async () => {
      await ended;
      const api = await callbackCalled;
      expect(api).to.have.property('state', 'idle');
    });
  });
});
