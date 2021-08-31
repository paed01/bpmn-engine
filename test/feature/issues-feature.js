'use strict';

const factory = require('../helpers/factory');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

Feature('Issues', () => {
  Scenario('Save state on wait - issue #105', () => {
    let source1, source2;
    before(() => {
      source1 = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definition_GeneralFlow" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="4.1.1">
        <bpmn:process id="Process_GeneralFlow" isExecutable="true">
          <bpmn:startEvent id="Start" name="Start">
            <bpmn:outgoing>Flow1</bpmn:outgoing>
          </bpmn:startEvent>
          <bpmn:endEvent id="End" name="End">
            <bpmn:incoming>FlowFalse2</bpmn:incoming>
            <bpmn:incoming>FlowLater</bpmn:incoming>
          </bpmn:endEvent>
          <bpmn:serviceTask id="Task2" name="Task2" implementation="\${environment.services.doTask2}">
            <bpmn:incoming>FlowTrue1</bpmn:incoming>
            <bpmn:incoming>Flow1</bpmn:incoming>
            <bpmn:outgoing>Flow3</bpmn:outgoing>
          </bpmn:serviceTask>
          <bpmn:userTask id="UserTask" name="UserTask">
            <bpmn:incoming>FlowFirst</bpmn:incoming>
            <bpmn:outgoing>Flow4</bpmn:outgoing>
          </bpmn:userTask>
          <bpmn:exclusiveGateway id="Gateway1" name="Gateway1">
            <bpmn:incoming>Flow3</bpmn:incoming>
            <bpmn:outgoing>FlowFirst</bpmn:outgoing>
            <bpmn:outgoing>FlowLater</bpmn:outgoing>
          </bpmn:exclusiveGateway>
          <bpmn:exclusiveGateway id="Gateway2" name="Gateway2">
            <bpmn:incoming>Flow4</bpmn:incoming>
            <bpmn:outgoing>FlowFalse2</bpmn:outgoing>
            <bpmn:outgoing>FlowTrue1</bpmn:outgoing>
          </bpmn:exclusiveGateway>
          <bpmn:sequenceFlow id="Flow1" name="Flow1" sourceRef="Start" targetRef="Task2" />
          <bpmn:sequenceFlow id="Flow3" name="Flow3" sourceRef="Task2" targetRef="Gateway1" />
          <bpmn:sequenceFlow id="Flow4" name="Flow4" sourceRef="UserTask" targetRef="Gateway2" />
          <bpmn:sequenceFlow id="FlowFirst" name="FlowFirst" sourceRef="Gateway1" targetRef="UserTask">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, this.environment.variables.passTask2&gt;=0);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowLater" name="FlowLater" sourceRef="Gateway1" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, this.environment.variables.passTask2&lt;0);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowFalse2" name="FlowFalse2" sourceRef="Gateway2" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, false);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowTrue1" name="FlowTrue1" sourceRef="Gateway2" targetRef="Task2">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, true);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
        </bpmn:process>
      </bpmn:definitions>`;
      source2 = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definition_GeneralFlow" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="4.1.1">
        <bpmn:process id="Process_GeneralFlow" isExecutable="true">
          <bpmn:startEvent id="Start" name="Start">
            <bpmn:outgoing>Flow1</bpmn:outgoing>
          </bpmn:startEvent>
          <bpmn:endEvent id="End" name="End">
            <bpmn:incoming>FlowFalse2</bpmn:incoming>
            <bpmn:incoming>FlowLater</bpmn:incoming>
          </bpmn:endEvent>
          <bpmn:serviceTask id="Task1" name="Task1" implementation="\${environment.services.doTask1}">
            <bpmn:incoming>Flow1</bpmn:incoming>
            <bpmn:incoming>FlowFalse1</bpmn:incoming>
            <bpmn:outgoing>Flow2</bpmn:outgoing>
          </bpmn:serviceTask>
          <bpmn:serviceTask id="Task2" name="Task2" implementation="\${environment.services.doTask2}">
            <bpmn:incoming>Flow2</bpmn:incoming>
            <bpmn:incoming>FlowTrue1</bpmn:incoming>
            <bpmn:outgoing>Flow3</bpmn:outgoing>
          </bpmn:serviceTask>
          <bpmn:userTask id="UserTask" name="UserTask">
            <bpmn:incoming>FlowFirst</bpmn:incoming>
            <bpmn:outgoing>Flow4</bpmn:outgoing>
          </bpmn:userTask>
          <bpmn:exclusiveGateway id="Gateway1" name="Gateway1">
            <bpmn:incoming>Flow3</bpmn:incoming>
            <bpmn:outgoing>FlowFirst</bpmn:outgoing>
            <bpmn:outgoing>FlowLater</bpmn:outgoing>
          </bpmn:exclusiveGateway>
          <bpmn:exclusiveGateway id="Gateway2" name="Gateway2">
            <bpmn:incoming>Flow4</bpmn:incoming>
            <bpmn:outgoing>FlowFalse1</bpmn:outgoing>
            <bpmn:outgoing>FlowFalse2</bpmn:outgoing>
            <bpmn:outgoing>FlowTrue1</bpmn:outgoing>
          </bpmn:exclusiveGateway>
          <bpmn:sequenceFlow id="Flow1" name="Flow1" sourceRef="Start" targetRef="Task1" />
          <bpmn:sequenceFlow id="Flow2" name="Flow2" sourceRef="Task1" targetRef="Task2" />
          <bpmn:sequenceFlow id="Flow3" name="Flow3" sourceRef="Task2" targetRef="Gateway1" />
          <bpmn:sequenceFlow id="Flow4" name="Flow4" sourceRef="UserTask" targetRef="Gateway2" />
          <bpmn:sequenceFlow id="FlowFirst" name="FlowFirst" sourceRef="Gateway1" targetRef="UserTask">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, this.environment.variables.passTask2&gt;=0);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowLater" name="FlowLater" sourceRef="Gateway1" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, this.environment.variables.passTask2&lt;0);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowFalse1" name="FlowFalse1" sourceRef="Gateway2" targetRef="Task1">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, false);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowFalse2" name="FlowFalse2" sourceRef="Gateway2" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, false);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowTrue1" name="FlowTrue1" sourceRef="Gateway2" targetRef="Task2">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, true);</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
        </bpmn:process>
      </bpmn:definitions>`;
    });

    describe('first source', () => {
      let engine, options;
      const states = [];
      Given('one service, two exclusive gateways, one user task with save state extension, and one loopback flow', async () => {
        options = {
          name: 'issue 105',
          source: source1,
          services: {
            async doTask1(scope, callback) {
              await sleep(50); // calling other heavy service...
              return callback(null);
            },
            async doTask2(scope, callback) {
              await sleep(50); // calling other heavy service...
              scope.environment.variables.passTask2--;
              return callback(null);
            },
          },
          extensions: {
            listenUserTask(activity) {
              if (activity.id !== 'UserTask') return;

              activity.on('wait', async (api) => {
                api.owner.logger.debug('##### log state immediately in wait');
                states.push(JSON.stringify(await engine.getState()));
                engine.emit('wait', api);
              });
            },
          }
        };

        function sleep(msec) {
          return new Promise((resolve) => {
            setTimeout(resolve, msec);
          });
        }
      });

      let execution, end, wait;
      When('definition is ran', async () => {
        engine = Engine({
          ...options,
          variables: {
            passTask2: 1
          },
        });

        end = engine.waitFor('end');
        wait = engine.waitFor('wait');

        execution = await engine.execute();
      });

      let userApi;
      Then('user task waits for signal', async () => {
        userApi = await wait;
      });

      When('signaled', () => {
        userApi.signal();
      });

      Then('execution completes', () => {
        return end;
      });

      And('user task was discarded once', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 1);
      });

      And('end was discarded thrice', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 3);
      });

      When('executed again', async () => {
        engine = Engine({
          ...options,
          variables: {
            passTask2: 1
          },
        });

        end = engine.waitFor('end');
        wait = engine.waitFor('wait');

        execution = await engine.execute();
      });

      Then('user task waits for signal again', () => {
        return wait;
      });

      Given('run is stopped', () => {
        engine.stop();
      });

      When('execution is resumed', async () => {
        wait = engine.waitFor('wait');
        end = engine.waitFor('end');

        execution = await engine.resume();
      });

      Then('resumed user task waits for signal', async () => {
        userApi = await wait;
      });

      When('signaled', () => {
        userApi.signal();
      });

      Then('resumed execution completes', () => {
        return end;
      });

      And('user task was discarded once', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 1);
      });

      And('end was discarded thrice', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 3);
      });

      When('execution is recovered with state from first run user task wait', () => {
        engine = Engine(options);
        engine.recover(JSON.parse(states[0]));
      });

      And('resumed', async () => {
        end = engine.waitFor('end');
        wait = engine.waitFor('wait');

        let count = 0;
        engine.broker.subscribeTmp('event', 'activity.discard', (_, msg) => {
          if (msg.content.id === 'UserTask') {
            if (count++ > 3) {
              throw new Error('Into infinity');
            }
          }
        }, {noAck: true});

        execution = await engine.resume();
      });

      Then('user task waits for signal again', async () => {
        userApi = await wait;
      });

      When('signaled', () => {
        userApi.signal();
      });

      Then('recovered execution completes', () => {
        return end;
      });

      And('user task was discarded once', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 1);
      });

      And('end was discarded thrice', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 3);
      });

      Given('ran again', async () => {
        states.splice(0);
        engine = Engine({...options, variables: {
          passTask2: 1,
        }});
        wait = engine.waitFor('wait');
        execution = await engine.execute();
      });

      When('user task is waiting', () => {
        return wait;
      });

      let state;
      Then('state was saved', () => {
        expect(states).to.have.length(1);
        state = JSON.parse(states[0]);
      });

      And('end event was not discarded yet', () => {
        expect(state.definitions[0].execution.processes[0].execution.children.find(({id}) => id === 'End').counters).to.deep.equal({taken: 0, discarded: 0});
      });

      When('definition is recovered with state', async () => {
        engine = Engine(options);
        engine.recover(state);

        end = engine.waitFor('end');
      });

      Then('end event is still not discarded', async () => {
        const [definition] = await engine.getDefinitions();
        expect(definition.getActivityById('End').counters).to.deep.equal({taken: 0, discarded: 0});
      });

      When('definition is resumed', async () => {
        execution = await engine.resume();
      });

      Then('end event is discarded once', () => {
        expect(execution.getActivityById('End').counters).to.deep.equal({taken: 0, discarded: 1});
      });

      When('user task is signaled', async () => {
        execution.signal({id: 'UserTask'});
      });

      Then('recovered engine execution completes', () => {
        return end;
      });

      Then('end event is taken once and discarded thrice', () => {
        expect(execution.getActivityById('End').counters).to.deep.equal({taken: 1, discarded: 3});
      });
    });

    describe('second source', () => {
      let engine, options;
      const states = [];
      Given('one service, two exclusive gateways, one user task with save state extension, and two loopback flows', async () => {
        options = {
          name: 'issue 105',
          source: source2,
          services: {
            async doTask1(scope, callback) {
              await sleep(50); // calling other heavy service...
              return callback(null);
            },
            async doTask2(scope, callback) {
              await sleep(50); // calling other heavy service...
              scope.environment.variables.passTask2--;
              return callback(null);
            },
          },
          extensions: {
            listenUserTask(activity) {
              if (activity.id !== 'UserTask') return;

              activity.on('wait', async (api) => {
                api.owner.logger.debug('##### log state immediately in wait');
                states.push(JSON.stringify(await engine.getState()));
                engine.emit('wait', api);
              });
            },
          }
        };

        function sleep(msec) {
          return new Promise((resolve) => {
            setTimeout(resolve, msec);
          });
        }
      });

      let execution, end, wait;
      When('definition is ran', async () => {
        engine = Engine({
          ...options,
          variables: {
            passTask2: 1
          },
        });

        end = engine.waitFor('end');
        wait = engine.waitFor('wait');

        execution = await engine.execute();
      });

      let userApi;
      Then('user task waits for signal', async () => {
        userApi = await wait;
      });

      When('signaled', () => {
        userApi.signal();
      });

      Then('execution completes', () => {
        return end;
      });

      And('user task was discarded twice', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 2);
      });

      And('end was discarded four times', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 4);
      });

      When('executed again', async () => {
        engine = Engine({
          ...options,
          variables: {
            passTask2: 1
          },
        });

        end = engine.waitFor('end');
        wait = engine.waitFor('wait');

        execution = await engine.execute();
      });

      Then('user task waits for signal again', () => {
        return wait;
      });

      Given('run is stopped', () => {
        engine.stop();
      });

      When('execution is resumed', async () => {
        wait = engine.waitFor('wait');
        end = engine.waitFor('end');

        execution = await engine.resume();
      });

      Then('resumed user task waits for signal', async () => {
        userApi = await wait;
      });

      When('signaled', () => {
        userApi.signal();
      });

      Then('resumed execution completes', () => {
        return end;
      });

      And('user task was discarded twice', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 2);
      });

      And('end was discarded four times', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 4);
      });

      When('execution is recovered with state from first run user task wait', () => {
        engine = Engine(options);
        engine.recover(JSON.parse(states[0]));
      });

      And('resumed', async () => {
        end = engine.waitFor('end');
        wait = engine.waitFor('wait');

        let count = 0;
        engine.broker.subscribeTmp('event', 'activity.discard', (_, msg) => {
          if (msg.content.id === 'UserTask') {
            if (count++ > 3) {
              throw new Error('Into infinity');
            }
          }
        }, {noAck: true});

        execution = await engine.resume();
      });

      Then('user task waits for signal again', async () => {
        userApi = await wait;
      });

      When('signaled', () => {
        userApi.signal();
      });

      Then('recovered execution completes', () => {
        return end;
      });

      And('user task was discarded twice', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 2);
      });

      And('end was discarded four times', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 4);
      });

      Given('ran again', async () => {
        states.splice(0);
        engine = Engine({...options, variables: {
          passTask2: 1,
        }});
        wait = engine.waitFor('wait');
        execution = await engine.execute();
      });

      When('user task is waiting', () => {
        return wait;
      });

      let state;
      Then('state was saved', () => {
        expect(states).to.have.length(1);
        state = JSON.parse(states[0]);
      });

      And('end event was not discarded yet', () => {
        expect(state.definitions[0].execution.processes[0].execution.children.find(({id}) => id === 'End').counters).to.deep.equal({taken: 0, discarded: 0});
      });

      When('definition is recovered with state', async () => {
        engine = Engine(options);
        engine.recover(state);

        end = engine.waitFor('end');
      });

      Then('end event is still not discarded', async () => {
        const [definition] = await engine.getDefinitions();
        expect(definition.getActivityById('End').counters).to.deep.equal({taken: 0, discarded: 0});
      });

      When('definition is resumed', async () => {
        execution = await engine.resume();
      });

      Then('end event is discarded once', () => {
        expect(execution.getActivityById('End').counters).to.deep.equal({taken: 0, discarded: 1});
      });

      When('user task is signaled', async () => {
        execution.signal({id: 'UserTask'});
      });

      Then('recovered engine execution completes', () => {
        return end;
      });

      And('user task was taken once and discarded twice', () => {
        const task = execution.getActivityById('UserTask');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 2);
      });

      And('end was taken once and discarded four times', () => {
        const task = execution.getActivityById('End');
        expect(task.counters).to.have.property('taken', 1);
        expect(task.counters).to.have.property('discarded', 4);
      });
    });
  });

  Scenario('Stop and save state on wait - issue #106', () => {
    const source = `
    <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="Process_0" isExecutable="true">
        <startEvent id="start" />
        <sequenceFlow id="to-task1" sourceRef="start" targetRef="task1" />
        <userTask id="task1" />
        <sequenceFlow id="to-task2" sourceRef="task1" targetRef="task2" />
        <userTask id="task2" />
        <sequenceFlow id="to-decision" sourceRef="task2" targetRef="decision" />
        <exclusiveGateway id="decision" default="to-task4" />
        <sequenceFlow id="to-task3" sourceRef="decision" targetRef="task3">
          <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, this.environment.variables.takeTask3&gt;=0);</bpmn:conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="to-task4" sourceRef="decision" targetRef="task4" />
        <userTask id="task3" />
        <sequenceFlow id="from-task3" sourceRef="task3" targetRef="end" />
        <userTask id="task4" />
        <sequenceFlow id="from-task4" sourceRef="task4" targetRef="end" />
        <endEvent id="end" />
      </process>
    </definitions>`;

    let engine, options;
    const states = [];
    Given('two succeeding user tasks and decision to take third or fourth user task', async () => {
      options = {
        name: 'issue 106',
        source,
      };
    });

    async function onWait(activityApi, execution) {
      if (activityApi.content.isRecovered) return;

      execution.stop();
      states.push(execution.getState());
    }

    let execution, listener;
    When('engine is executed with listener on activity wait', async () => {
      listener = new EventEmitter();
      listener.on('activity.wait', onWait);

      engine = Engine({
        ...options,
        variables: {
          takeTask3: 1
        },
      });

      execution = await engine.execute({listener});
    });

    Then('execution is stopped and state is saved', () => {
      expect(execution.stopped).to.be.true;
      expect(states).to.have.length(1);
    });

    When('execution is recovered', () => {
      engine = Engine().recover(states.pop());
    });

    Then('first user task is still executing', async () => {
      const [definition] = await engine.getDefinitions();
      expect(definition.getActivityById('task1')).to.have.property('status', 'executing');
    });

    When('execution is resumed with listener', async () => {
      execution = await engine.resume({listener});
    });

    And('first user task is signaled', () => {
      execution.signal({id: 'task1'});
    });

    Then('first user task was taken', () => {
      expect(execution.getActivityById('task1').counters).to.deep.equal({taken: 1, discarded: 0});
    });

    And('second user task is waiting', () => {
      expect(execution.getActivityById('task2').counters).to.deep.equal({taken: 0, discarded: 0});
    });

    When('execution is recovered', () => {
      engine = Engine().recover(states.pop());
    });

    Then('second user task is still executing', async () => {
      const [definition] = await engine.getDefinitions();
      expect(definition.getActivityById('task2')).to.have.property('status', 'executing');
    });

    When('execution is resumed with listener', async () => {
      execution = await engine.resume({listener});
    });

    And('second user task is signaled', () => {
      execution.signal({id: 'task2'});
    });

    Then('first user task was taken', () => {
      expect(execution.getActivityById('task1').counters).to.deep.equal({taken: 1, discarded: 0});
    });

    And('second user task was taken', () => {
      expect(execution.getActivityById('task2').counters).to.deep.equal({taken: 1, discarded: 0});
    });

    And('third user task is waiting', () => {
      expect(execution.getActivityById('task3').counters).to.deep.equal({taken: 0, discarded: 0});
    });

    And('fourth user task was discarded', () => {
      expect(execution.getActivityById('task4').counters).to.deep.equal({taken: 0, discarded: 1});
    });

    let end;
    When('execution is recovered', () => {
      engine = Engine().recover(states.pop());
      end = engine.waitFor('end');
    });

    Then('third user task is still executing', async () => {
      const [definition] = await engine.getDefinitions();
      expect(definition.getActivityById('task3')).to.have.property('status', 'executing');
    });

    When('execution is resumed with listener', async () => {
      execution = await engine.resume({listener});
    });

    And('third user task is signaled', () => {
      execution.signal({id: 'task3'});
    });

    Then('first user task was taken', () => {
      expect(execution.getActivityById('task1').counters).to.deep.equal({taken: 1, discarded: 0});
    });

    And('second user task was taken', () => {
      expect(execution.getActivityById('task2').counters).to.deep.equal({taken: 1, discarded: 0});
    });

    And('third user task was taken', () => {
      expect(execution.getActivityById('task3').counters).to.deep.equal({taken: 1, discarded: 0});
    });

    And('fourth user task was discarded', () => {
      expect(execution.getActivityById('task4').counters).to.deep.equal({taken: 0, discarded: 1});
    });

    And('execution completed', () => {
      return end;
    });
  });

  Scenario('Parallel Join stuck in postponed state - issue #125', () => {
    async function Start(source) {
      const engine = Engine({
        name: 'issue 125',
        source,
      });

      const complete = stopOrEnd(engine);

      const execution = await engine.execute();
      const waiting = execution.getPostponed();
      execution.stop();

      const status = await complete;

      const startState = execution.getState();
      return {engine, waiting, state: startState, status};
    }

    async function Tick(state) {
      const engine = Engine({
        name: 'issue 125 - recover',
      }).recover(state);

      const complete = stopOrEnd(engine);
      const execution = await engine.resume();

      const waiting = execution.getPostponed();
      await engine.stop();

      const status = await complete;

      const tickState = execution.getState();
      return {engine, waiting, state: tickState, status};
    }

    async function Input(state, signalId) {
      const engine = Engine({
        name: 'issue 125 - signal',
      }).recover(state);

      const complete = stopOrEnd(engine);
      const execution = await engine.resume();

      execution.signal({
        id: signalId,
      });

      execution.stop();

      const waiting = execution.getPostponed();
      const inputState = execution.getState();

      const status = await complete;

      return {engine, waiting, state: inputState, status};
    }

    function stopOrEnd(engine) {
      return new Promise((resolve, reject) => {
        engine.once('end', onEnd);
        engine.once('stop', onStop);
        engine.once('error', onError);

        function onEnd() {
          engine.removeListener('stop', onStop);
          engine.removeListener('error', onError);
          resolve('end');
        }
        function onStop() {
          engine.removeListener('end', onEnd);
          engine.removeListener('error', onError);
          resolve('stop');
        }
        function onError(err) {
          engine.removeListener('end', onEnd);
          engine.removeListener('stop', onStop);
          reject(err);
        }
      });
    }

    let result;
    When('forking two user tasks, then join, and immediate stop', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Issue_125" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="parallel" isExecutable="true">
          <startEvent id="start" name="START" />
          <sequenceFlow id="to-fork" sourceRef="start" targetRef="fork" />
          <parallelGateway id="fork" name="FORK" />
          <sequenceFlow id="to-a" sourceRef="fork" targetRef="A" />
          <sequenceFlow id="to-b" sourceRef="fork" targetRef="B" />
          <sequenceFlow id="from-a" sourceRef="A" targetRef="join" />
          <parallelGateway id="join" name="JOIN" />
          <sequenceFlow id="from-b" sourceRef="B" targetRef="join" />
          <userTask id="A" name="A" />
          <userTask id="B" name="B" />
          <sequenceFlow id="to-end" sourceRef="join" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      result = await Start(source);
    });

    Then('status is stopped', () => {
      expect(result.status).to.equal('stop');
    });

    When('ticked', async () => {
      result = await Tick(result.state);
    });

    Then('user tasks are waiting', () => {
      expect(result.status).to.equal('stop');
      expect(result.waiting).to.have.length(2);
      expect(result.waiting[0]).to.have.property('id', 'A');
      expect(result.waiting[1]).to.have.property('id', 'B');
    });

    When('first user task is signaled', async () => {
      result = await Input(result.state, 'A');
    });

    Then('second user task is still waiting', () => {
      expect(result.status).to.equal('stop');
      expect(result.waiting.find(({id}) => id === 'B')).to.be.ok;
    });

    When('ticked', async () => {
      result = await Tick(result.state);
    });

    Then('second user task is still waiting', () => {
      expect(result.status).to.equal('stop');
      expect(result.waiting.find(({id}) => id === 'B')).to.be.ok;
    });

    When('second user task is signaled', async () => {
      result = await Input(result.state, 'B');
    });

    Then('no user task is waiting', () => {
      expect(result.waiting.some(({type}) => type === 'bpmn:UserTask')).to.not.be.ok;
    });

    And('run has completed', () => {
      expect(result.status).to.equal('end');
    });
  });

  Scenario('One or the other manual task - issue #138', () => {
    let engine, execution;
    When('forking two manual tasks, then signal to cancel the other', async () => {
      const source = factory.resource('one-or-the-other.bpmn');

      engine = Engine({
        source,
      });

      execution = await engine.execute();
    });

    Then('execution waits for both tasks', () => {
      const postponed = execution.getPostponed();
      expect(postponed.find(({id}) => id === 'task1')).to.be.ok;
      expect(postponed.find(({id}) => id === 'task2')).to.be.ok;
    });

    let ended;
    When('first task is signaled', () => {
      ended = engine.waitFor('end');
      execution.signal({id: 'task1'});
    });

    Then('execution completes', () => {
      return ended;
    });

    And('second task was discarded', () => {
      expect(execution.getActivityById('task2').counters).to.include({
        taken: 0,
        discarded: 1,
      });
    });

    When('ran again', async () => {
      execution = await engine.execute();
    });

    When('second task is signaled', () => {
      ended = engine.waitFor('end');
      execution.signal({id: 'task2'});
    });

    Then('execution completes', () => {
      return ended;
    });

    And('second task was taken', () => {
      expect(execution.getActivityById('task2').counters).to.include({
        taken: 1,
        discarded: 0,
      });
    });

    And('firsts task was discarded', () => {
      expect(execution.getActivityById('task1').counters).to.include({
        taken: 0,
        discarded: 1,
      });
    });
  });

  Scenario('Get name and association of a DataObject (BPMN:DataObjectReference) - issue 139', () => {
    let engine, task;
    When('activity have properties and DataObject references', async () => {
      const source = factory.resource('issue-139.bpmn');

      const listener = new EventEmitter();
      listener.on('activity.start', (activityApi) => {
        if (activityApi.type === 'bpmn:Task') {
          task = activityApi;
        }
      });

      engine = Engine({
        source,
        listener,
      });

      await engine.execute();
    });

    Then('activity contains properties and data object references', () => {
      expect(task.content.properties).to.be.an('object').with.property('Property_0qusu4o');
    });
  });
});
