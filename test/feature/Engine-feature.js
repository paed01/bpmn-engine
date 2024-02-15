import { EventEmitter } from 'events';
import { Engine } from '../../src/index.js';
import * as factory from '../helpers/factory.js';
import { camundaBpmnModdle as camunda } from '../helpers/testHelpers.js';

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
          },
        },
      });
    });

    And('activity status is idle', () => {
      expect(engine.activityStatus).to.equal('idle');
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

    And('activity status is wait', () => {
      expect(engine.activityStatus).to.equal('wait');
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

    And('activity status is idle', () => {
      expect(engine.activityStatus).to.equal('idle');
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
        source,
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
      return engine.execute({ listener });
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
          camunda,
        },
        extensions: {
          fetchForm(activity) {
            if (!activity.behaviour.formKey) return;

            const endRoutingKey = 'run.form.end';

            activity.on('enter', () => {
              activity.broker.publish('format', 'run.form.start', { endRoutingKey });

              getForm(activity).then((form) => {
                activity.broker.publish('format', endRoutingKey, { form });
              });
            });
          },
          saveToEnvironmentOutput(activity, { environment }) {
            activity.on('end', (api) => {
              environment.output[api.id] = api.content.output;
            });
          },
        },
      });

      function getForm(activity) {
        return new Promise((resolve) => {
          return resolve({
            id: activity.behaviour.formKey,
            fields: {
              surname: '',
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

    And('activity status is wait', () => {
      expect(engine.activityStatus).to.equal('wait');
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
        surname: 'von Rosen',
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
      expect(engine.environment.output).to.have.property('task1').that.eql({ surname: 'von Rosen' });
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
          },
        },
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
    When('source is executed with a callback', () => {
      complete = engine.waitFor('end');

      callbackCalled = new Promise((resolve, reject) => {
        engine.execute({ listener }, (err, endApi) => {
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
          },
        },
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
    When('source is executed with a callback', () => {
      stopped = engine.waitFor('stop');

      callbackCalled = new Promise((resolve, reject) => {
        engine.execute({ listener }, (err, endApi) => {
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
    When('engine is resumed with a callback', () => {
      ended = engine.waitFor('end');

      callbackCalled = new Promise((resolve, reject) => {
        engine.resume({ listener }, (err, endApi) => {
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
