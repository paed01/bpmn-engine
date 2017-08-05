'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('Task', () => {
  describe('behaviour', () => {
    const taskProcessXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <task id="task">
          <extensionElements>
            <camunda:inputOutput>
              <camunda:inputParameter name="input">\${variables.message}</camunda:inputParameter>
              <camunda:outputParameter name="output">Signaled \${input} with \${result}</camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </task>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(taskProcessXml, moddleOptions, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    describe('activate()', () => {
      it('returns activity api', (done) => {
        const task = context.getChildActivityById('task');
        const activityApi = task.activate();
        expect(activityApi).to.exist();
        done();
      });

      it('activity api has the expected properties', (done) => {
        const task = context.getChildActivityById('task');
        const activityApi = task.activate();
        expect(activityApi).to.include({
          id: 'task',
          type: 'bpmn:Task'
        });
        expect(activityApi.inbound).to.be.an.array().and.have.length(1);
        expect(activityApi.outbound).to.be.an.array().and.have.length(1);
        done();
      });

      it('activity api has the expected functions', (done) => {
        const task = context.getChildActivityById('task');
        const activityApi = task.activate();
        expect(activityApi.run, 'run').to.be.a.function();
        expect(activityApi.deactivate, 'deactivate').to.be.a.function();
        expect(activityApi.execute, 'execute').to.be.a.function();
        expect(activityApi.getState, 'getState').to.be.a.function();
        expect(activityApi.resume, 'resume').to.be.a.function();
        expect(activityApi.getApi, 'getApi').to.be.a.function();
        done();
      });
    });

    describe('events', () => {
      it('emits start on taken inbound', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();
        task.once('start', () => {
          done();
        });

        task.inbound[0].take();
      });

      it('leaves on discarded inbound', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();
        task.once('start', () => {
          fail('No start should happen');
        });
        task.once('leave', () => {
          done();
        });

        task.inbound[0].discard();
      });

      it('emits end after start when inbound taken', (done) => {
        const task = context.getChildActivityById('task');

        task.activate();

        const eventNames = [];
        task.once('start', () => {
          eventNames.push('start');
        });
        task.once('end', (activity) => {
          expect(activity.id).to.equal('task');
          expect(eventNames).to.equal(['start']);
          done();
        });

        task.inbound[0].take();
      });

      it('emits leave when completed', (done) => {
        const task = context.getChildActivityById('task');

        task.activate();

        const eventNames = [];
        task.once('start', () => {
          eventNames.push('start');
        });
        task.once('end', () => {
          eventNames.push('end');
        });
        task.once('leave', () => {
          expect(eventNames).to.equal(['start', 'end']);
          done();
        });

        task.inbound[0].take();
      });
    });
  });

  lab.describe('events', () => {
    const taskProcessXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <task id="task" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    lab.beforeEach((done) => {
      testHelpers.getContext(taskProcessXml, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    lab.test('emits start on taken inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('start', () => {
        done();
      });

      task.inbound[0].take();
    });

    lab.test('leaves on discarded inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('start', () => {
        fail('No start should happen');
      });
      task.once('leave', () => {
        done();
      });

      task.inbound[0].discard();
    });
  });

  lab.describe('IO', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <task id="task">
          <extensionElements>
            <camunda:inputOutput>
              <camunda:inputParameter name="input">\${variables.message}</camunda:inputParameter>
              <camunda:outputParameter name="output">Input was \${input}</camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </task>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    lab.beforeEach((done) => {
      testHelpers.getContext(source, moddleOptions, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    lab.test('event argument getInput() on start returns input parameters', (done) => {
      context.environment.assignVariables({
        message: 'exec'
      });

      const task = context.getChildActivityById('task');
      task.activate();
      task.once('start', (activity, execution) => {
        expect(execution.getInput()).to.equal({
          input: 'exec'
        });
        done();
      });

      task.inbound[0].take();
    });

    lab.test('event argument getOutput() on end returns output parameter value based on input parameters', (done) => {
      context.environment.assignVariables({
        message: 'exec'
      });

      const task = context.getChildActivityById('task');
      task.activate();
      task.once('end', (activity, execution) => {
        expect(execution.getOutput()).to.equal({
          output: 'Input was exec'
        });
        done();
      });

      task.inbound[0].take();
    });
  });

  lab.describe('engine', () => {
    lab.test('multiple inbound completes process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="testProcess" isExecutable="true">
          <startEvent id="start" />
          <task id="task" />
          <exclusiveGateway id="decision" default="flow3">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="defaultTaken">\${true}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </exclusiveGateway>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
          <sequenceFlow id="flow2" sourceRef="task" targetRef="decision" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="task" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression">\${variables.defaultTaken}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activity) => {
        startCount++;
        if (startCount > 2) {
          fail(`<${activity.id}> Too many starts`);
        }
      });
      let endEventCount = 0;
      listener.on('start-end', () => {
        endEventCount++;
      });

      engine.execute({
        listener
      });
      engine.once('end', () => {
        expect(startCount, 'task starts').to.equal(2);
        expect(endEventCount, 'end event').to.equal(1);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });

  lab.describe('loop', () => {
    lab.describe('sequential', () => {
      let context;
      lab.beforeEach((done) => {
        getLoopContext(true, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      lab.test('emits start with the same id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('start', (activity) => {
          starts.push(activity.id);
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts).to.be.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      lab.test('assigns input', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const doneTasks = [];
        task.on('start', (activity, execution) => {
          doneTasks.push(execution.getInput().do);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);
          done();
        });

        task.run();
      });

    });

    lab.describe('parallell', () => {
      let context;
      lab.beforeEach((done) => {
        getLoopContext(false, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      lab.test('emits start with different ids', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('start', (activity, execution) => {
          starts.push(execution.id);
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      lab.test('assigns input', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('start', (activity, execution) => {
          starts.push(execution.getInput());
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts).to.equal([{do: 'labour'}, {do: 'archiving'}, {do: 'shopping'}]);
          done();
        });

        task.run();
      });
    });
  });
});

function getLoopContext(isSequential, callback) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="sequentialLoopProcess" isExecutable="true">
      <task id="task">
        <multiInstanceLoopCharacteristics isSequential="${isSequential}" camunda:collection="\${variables.analogue}">
          <loopCardinality>5</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="do">\${item}</camunda:inputParameter>
          </camunda:inputOutput>
        </extensionElements>
      </task>
    </process>
  </definitions>`;
  testHelpers.getContext(source, moddleOptions, (err, context) => {
    if (err) return callback(err);
    context.environment.assignVariables({analogue: ['labour', 'archiving', 'shopping']});
    callback(null, context);
  });
}
