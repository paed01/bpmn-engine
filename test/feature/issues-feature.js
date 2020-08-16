'use strict';

const {Engine} = require('../..');

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
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">this.environment.variables.passTask2&gt;=0</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowLater" name="FlowLater" sourceRef="Gateway1" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">this.environment.variables.passTask2&lt;0</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowFalse2" name="FlowFalse2" sourceRef="Gateway2" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">false</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowTrue1" name="FlowTrue1" sourceRef="Gateway2" targetRef="Task2">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">true</bpmn:conditionExpression>
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
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">this.environment.variables.passTask2&gt;=0</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowLater" name="FlowLater" sourceRef="Gateway1" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">this.environment.variables.passTask2&lt;0</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowFalse1" name="FlowFalse1" sourceRef="Gateway2" targetRef="Task1">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">false</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowFalse2" name="FlowFalse2" sourceRef="Gateway2" targetRef="End">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">false</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="FlowTrue1" name="FlowTrue1" sourceRef="Gateway2" targetRef="Task2">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">true</bpmn:conditionExpression>
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
});
