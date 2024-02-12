'use strict';

const factory = require('./helpers/factory.js');
const {Engine} = require('../index.js');
const {EventEmitter} = require('events');

describe('issues', () => {
  describe('issue 19 - save state', () => {
    it('make sure there is something to save on activity start event', async () => {
      const messages = [];
      const services = {
        timeout: (cb, time) => {
          setTimeout(cb, time);
        },
        log: (message) => {
          messages.push(message);
        },
      };

      const listener = new EventEmitter();
      const engine = new Engine({
        name: 'Engine',
        source: factory.resource('issue-19.bpmn'),
        listener,
      });

      const states = [];

      listener.on('activity.start', (activity, engineApi) => {
        states.push(engineApi.getState());
      });

      const end = engine.waitFor('end');

      await engine.execute({
        listener,
        variables: {
          timeout: 100,
        },
        services,
      });

      await end;

      expect(states).to.have.length(7);

      for (const state of states) {
        expect(state).to.have.property('definitions').with.length(1);
        expect(state.definitions[0]).to.have.property('execution');
        expect(state.definitions[0].execution).to.have.property('processes').with.length(1);
        expect(state.definitions[0].execution.processes[0]).to.have.property('execution');
        expect(state.definitions[0].execution.processes[0].execution).to.have.property('children').with.length(7);

        const children = state.definitions[0].execution.processes[0].execution.children;

        expect(children.map(({id}) => id)).to.eql(['Start', 'Parallel1', 'Task_A', 'Task_B', 'Parallel2', 'Task_C', 'End']);
      }

      let [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[0].definitions[0].execution.processes[0].execution.children;
      expect(Start, 'state 0 Start').to.have.property('status', 'started');
      expect(Parallel1, 'state 0 Parallel1').to.not.have.property('status');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[1].definitions[0].execution.processes[0].execution.children;
      expect(Start, 'state 1 Start').to.have.property('status', 'end');
      expect(Parallel1, 'state 1 Parallel1').to.have.property('status', 'started');
      expect(Task_A, 'state 1 Task_A').to.not.have.property('status');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[2].definitions[0].execution.processes[0].execution.children;
      expect(Parallel1, 'state 2 Parallel1').to.have.property('status', 'end');
      expect(Task_A, 'state 2 Task_A').to.have.property('status', 'started');
      expect(Task_B, 'state 2 Task_B').to.not.have.property('status');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[3].definitions[0].execution.processes[0].execution.children;
      expect(Parallel1, 'state 3 Parallel1').to.have.property('status', 'end');
      expect(Task_A, 'state 3 Task_A').to.not.have.property('status');
      expect(Task_B, 'state 3 Task_B').to.have.property('status', 'started');
      expect(Parallel2, 'state 3 Parallel2').to.not.have.property('status');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[4].definitions[0].execution.processes[0].execution.children;
      expect(Task_A, 'state 4 Task_A').to.not.have.property('status');
      expect(Task_B, 'state 4 Task_B').to.have.property('status', 'end');
      expect(Parallel2, 'state 4 Parallel2').to.have.property('status', 'started');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[5].definitions[0].execution.processes[0].execution.children;
      expect(Parallel2, 'state 5 Parallel2').to.have.property('status', 'end');
      expect(Task_C, 'state 5 Task_C').to.have.property('status', 'started');
      expect(End, 'state 5 End').to.not.have.property('status');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[6].definitions[0].execution.processes[0].execution.children;
      expect(Task_C, 'state 6 Task_C').to.have.property('status', 'end');
      expect(End, 'state 6 End').to.have.property('status', 'started');
    });
  });

  describe('issue 74 - setting engine output from script', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
    <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_01d9p2c" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="3.2.3">
      <bpmn:process id="first_process" isExecutable="true" camunda:versionTag="1.0" camunda:historyTimeToLive="365">
        <bpmn:startEvent id="StartEvent_0an034v" />
        <bpmn:sequenceFlow id="SequenceFlow_19p3cf1" sourceRef="StartEvent_0an034v" targetRef="Task_0nh74lm" />
        <bpmn:endEvent id="IntermediateThrowEvent_1jovaga" name="Throw" />
        <bpmn:sequenceFlow id="SequenceFlow_0zn9m7b" sourceRef="Task_0nh74lm" targetRef="Task_1yzzr7e" />
        <bpmn:scriptTask id="Task_0nh74lm" name="Script" scriptFormat="javascript">
          <bpmn:script>environment.output.test = "set from script"; next()</bpmn:script>
        </bpmn:scriptTask>
        <bpmn:userTask id="Task_1yzzr7e" name="Get input">
          <bpmn:extensionElements>
            <camunda:properties>
              <camunda:property name="text" value="123" />
            </camunda:properties>
            <camunda:formData>
              <camunda:formField id="FormField_0ks539t" label="1" type="enum" />
            </camunda:formData>
          </bpmn:extensionElements>
        </bpmn:userTask>
        <bpmn:sequenceFlow id="SequenceFlow_183i0pk" sourceRef="Task_1yzzr7e" targetRef="IntermediateThrowEvent_1jovaga" />
      </bpmn:process>
      <bpmn:message id="Message_1my3vry" name="Message_3fks037" />
      <bpmn:signal id="Signal_0hs208i" name="Signal_0usjrve" />
    </bpmn:definitions>`;

    it('engine output is not altered during execution', async () => {
      const listener = new EventEmitter();
      const engine = new Engine({
        name: 'Engine',
        source,
        listener,
      });

      listener.on('activity.wait', (api) => {
        // When we get to the UserTask, the ScriptTask should be completed and set the output
        expect(api.environment.output.test, 'execution output').to.equal('set from script');
        expect(engine.environment.output.test, 'engine output').to.be.undefined;
      });

      await engine.execute({ listener });
    });

    it('merges execution output to engine output from a script at engine completion', async () => {
      const listener = new EventEmitter();
      const engine = new Engine({
        name: 'Engine',
        source,
        listener,
      });

      listener.on('activity.wait', (exec) => exec.signal());

      await engine.execute({ listener });

      expect(engine.environment.output.test).to.equal('set from script');
    });

    it('resumes with correct state', async () => {
      let state;

      const listener = new EventEmitter();
      const engine = new Engine({
        name: 'Engine',
        source,
        listener,
      });

      const resumeListener = new EventEmitter();
      const resumeEngine = new Engine({
        name: 'Engine',
        source,
        listener: resumeListener,
      });

      resumeListener.on('activity.wait', (exec) => {
        expect(exec.environment.output.test).to.equal('set from script');
      });

      listener.on('activity.wait', (exec) => {
        expect(exec.environment.output.test).to.equal('set from script');

        engine.getState().then((s) => {
          state = s;
          engine.stop();
        });
      });

      await engine.execute({ listener });

      resumeEngine.recover(state);

      await resumeEngine.resume({ listener: resumeListener });
    });
  });
});
