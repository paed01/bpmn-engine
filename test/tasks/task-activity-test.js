'use strict';

const factory = require('../helpers/factory');
const Process = require('../../lib/process');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../lib');
const {EventEmitter} = require('events');

describe('task activity', () => {

  describe('cancel()', () => {
    it('cancels bound events and takes all outbound', (done) => {
      const engine = new Engine({
        source: factory.resource('boundary-timeout.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait-userTask', (activityApi) => {
        activityApi.cancel();
      });

      engine.execute({
        listener
      });

      engine.once('end', (execution, definitionExecution) => {
        expect(definitionExecution.getChildState('join').taken, 'join').to.be.true;
        expect(definitionExecution.getChildState('end').taken, 'end').to.be.true;
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });

  describe('multiple inbounds', () => {
    it('completes process', (done) => {
      const engine = new Engine({
        source: factory.resource('task-multiple-inbound.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait', (activity) => {
        activity.signal({
          input: 1
        });
      });

      let taskCount = 0;
      listener.on('end-script', (a) => {
        taskCount++;
        if (taskCount > 3) {
          expect.fail(`Too many runs for <${a.id}>`);
        }
      });

      engine.execute({
        listener,
        variables: {
          input: 0
        }
      });

      engine.once('end', () => {
        done();
      });
    });

    it('multiple multiple completes process', (done) => {
      const source = `
      <bpmn:definitions id="Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="Process_1" isExecutable="true">
          <bpmn:startEvent id="StartEvent_1">
            <bpmn:outgoing>SequenceFlow_0q2oaww</bpmn:outgoing>
          </bpmn:startEvent>
          <bpmn:task id="task" name="Task">
            <bpmn:incoming>SequenceFlow_0q2oaww</bpmn:incoming>
            <bpmn:incoming>default-flow-2</bpmn:incoming>
            <bpmn:incoming>default-flow-1</bpmn:incoming>
            <bpmn:outgoing>taskflow-1</bpmn:outgoing>
          </bpmn:task>
          <bpmn:sequenceFlow id="SequenceFlow_0q2oaww" sourceRef="StartEvent_1" targetRef="task" />
          <bpmn:exclusiveGateway id="decision-1" default="default-flow-1">
            <bpmn:incoming>taskflow-1</bpmn:incoming>
            <bpmn:outgoing>condflow-1</bpmn:outgoing>
            <bpmn:outgoing>default-flow-1</bpmn:outgoing>
          </bpmn:exclusiveGateway>
          <bpmn:sequenceFlow id="taskflow-1" sourceRef="task" targetRef="decision-1" />
          <bpmn:exclusiveGateway id="decision-2" default="default-flow-2">
            <bpmn:incoming>condflow-1</bpmn:incoming>
            <bpmn:outgoing>condflow-2</bpmn:outgoing>
            <bpmn:outgoing>default-flow-2</bpmn:outgoing>
          </bpmn:exclusiveGateway>
          <bpmn:sequenceFlow id="condflow-1" sourceRef="decision-1" targetRef="decision-2">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${output.taskInput.decision-1.taken}</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:endEvent id="end">
            <bpmn:incoming>condflow-2</bpmn:incoming>
          </bpmn:endEvent>
          <bpmn:sequenceFlow id="condflow-2" sourceRef="decision-2" targetRef="end">
            <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${output.taskInput.decision-2.taken}</bpmn:conditionExpression>
          </bpmn:sequenceFlow>
          <bpmn:sequenceFlow id="default-flow-2" sourceRef="decision-2" targetRef="task" />
          <bpmn:sequenceFlow id="default-flow-1" sourceRef="decision-1" targetRef="task" />
        </bpmn:process>
      </bpmn:definitions>`;

      const engine = new Engine({
        source
      });

      const listener = new EventEmitter();
      let taskCount = 0;
      listener.on('start-task', (a) => {
        taskCount++;
        if (taskCount > 3) {
          expect.fail(`Too many runs (${taskCount}) for <${a.id}>`);
        }
      });

      listener.on('start', (activity) => {
        if (activity.type !== 'bpmn:ExclusiveGateway') return;

        activity.signal({
          taken: true
        });
      });

      engine.once('end', (execution, definitionExecution) => {
        expect(taskCount, 'start tasks').to.equal(3);
        expect(definitionExecution.getChildState('end').taken).to.be.true;
        done();
      });

      engine.execute({
        listener
      });

    });
  });

  describe('in lane with outbound message', () => {
    it('will have outbound that point to other lane', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const mainProcess = new Process(moddleContext.elementsById.mainProcess, moddleContext);
        const task = mainProcess.getChildActivityById('task1');
        expect(task.outbound).to.have.length(2);
        done();
      });
    });
  });
});
