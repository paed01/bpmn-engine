import { Engine } from '../../../src/index.js';

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" xmlns:color="http://www.omg.org/spec/BPMN/non-normative/color/1.0" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="18.1.1">
  <bpmn:process id="ReproduceProcess" name="Reproduce" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ScriptTask_1" />
    <bpmn:scriptTask id="ScriptTask_1" name="Script task 1" scriptFormat="Javascript">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:script>this.environment.services.log('hello from Script task 1');
next();</bpmn:script>
    </bpmn:scriptTask>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="ScriptTask_1" targetRef="UserTask_1" />
    <bpmn:userTask id="UserTask_1" name="User task 1">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="UserTask_1" targetRef="ScriptTask2" />
    <bpmn:scriptTask id="ScriptTask2" name="Sript task 2" scriptFormat="Javascript">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
      <bpmn:script>this.environment.services.log('hello from Script task 2');
next();</bpmn:script>
    </bpmn:scriptTask>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="ScriptTask2" targetRef="EndEvent_1" />
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>
`;

Feature('issue 199 - Issue with Script Tasks After State Recovery in bpmn-engine', () => {
  Scenario('execute, recover resume with same engine instance', () => {
    let engine;
    Given('an engine with user task flanked by two script tasks', () => {
      engine = new Engine({
        name: 'first',
        source,
        services: {
          log() {},
        },
      });
    });

    let execution;
    When('executed', async () => {
      execution = await engine.execute();
    });

    Then('engine should be in a running state', () => {
      expect(execution.state).to.equal('running');
    });

    let end;
    When('user task is signalled', () => {
      end = engine.waitFor('end');
      execution.signal({ id: 'UserTask_1' });
    });

    Then('run completed', () => {
      return end;
    });

    Given('a new engine instance', () => {
      engine = new Engine({
        name: 'second',
        source,
        services: {
          log() {},
        },
      });
    });

    let state;
    When('executed and get state', async () => {
      execution = await engine.execute();
      state = execution.getState();
    });

    Then('engine should be in a running state', () => {
      expect(execution.state).to.equal('running');
    });

    Given('execution is stopped', () => {
      return execution.stop();
    });

    When('same instance is recovered with options', () => {
      engine.recover(state, {
        services: {
          log() {},
        },
      });
    });

    And('resumed', () => {
      engine.resume();
    });

    Then('engine is still in a running state', () => {
      expect(engine.execution.state).to.equal('running');
    });

    When('resumed execution user task is signalled', () => {
      end = engine.waitFor('end');
      engine.execution.signal({ id: 'UserTask_1' });
    });
  });
});
