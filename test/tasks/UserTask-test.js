'use strict';

const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../lib');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('UserTask', () => {
  describe('behaviour', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <userTask id="task" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(source, (err, result) => {
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
          type: 'bpmn:UserTask'
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

      it('emits wait after start when inbound taken', (done) => {
        const task = context.getChildActivityById('task');

        task.activate();

        const eventNames = [];
        task.once('start', () => {
          eventNames.push('start');
        });
        task.once('wait', (activity) => {
          expect(activity.id).to.equal('task');
          expect(eventNames).to.equal(['start']);
          done();
        });

        task.inbound[0].take();
      });

      it('emits end when signal() is called', (done) => {
        const task = context.getChildActivityById('task');

        task.activate();

        const eventNames = [];
        task.once('start', () => {
          eventNames.push('start');
        });
        task.once('wait', (activityApi, executionContext) => {
          eventNames.push('wait');
          executionContext.signal();
        });
        task.once('end', () => {
          expect(eventNames).to.equal(['start', 'wait']);
          done();
        });

        task.inbound[0].take();
      });

      it('emits leave when signal() is called', (done) => {
        const task = context.getChildActivityById('task');

        task.activate();

        task.once('wait', (activityApi, executionContext) => {
          executionContext.signal();
        });
        task.once('leave', () => {
          done();
        });

        task.inbound[0].take();
      });
    });

    describe('getState()', () => {
      it('returns expected state on events', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();
        task.once('enter', (activityApi, executionApi) => {
          expect(activityApi.getApi(executionApi).getState()).to.equal({
            id: 'task',
            type: 'bpmn:UserTask',
            entered: true
          });
        });
        task.once('start', (activityApi, executionApi) => {
          expect(activityApi.getApi(executionApi).getState()).to.equal({
            id: 'task',
            type: 'bpmn:UserTask',
            entered: true
          });
        });
        task.once('wait', (activityApi, executionApi) => {
          expect(activityApi.getApi(executionApi).getState()).to.equal({
            id: 'task',
            type: 'bpmn:UserTask',
            entered: true,
            waiting: true
          });
          executionApi.signal();
        });
        task.once('end', (activityApi, executionApi) => {
          expect(activityApi.getApi(executionApi).getState()).to.equal({
            id: 'task',
            type: 'bpmn:UserTask',
            entered: undefined,
            waiting: undefined,
            taken: true
          });
        });
        task.once('leave', (activityApi, executionApi) => {
          expect(activityApi.getApi(executionApi).getState()).to.equal({
            id: 'task',
            type: 'bpmn:UserTask',
            entered: undefined,
            waiting: undefined,
            taken: true
          });
          done();
        });

        task.inbound[0].take();
      });
    });
  });

  describe('IO', () => {
    let context;
    beforeEach((done) => {
      testHelpers.getContext(factory.userTask('task'), (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('event argument getInput() on start returns input parameters', (done) => {
      context.environment.set('input', 'von Knaus');

      const task = context.getChildActivityById('task');
      task.activate();
      task.once('start', (activityApi, executionContext) => {
        expect(executionContext.getInput()).to.equal({
          Surname: 'von Knaus'
        });
        done();
      });

      task.inbound[0].take();
    });

    it('event argument getOutput() on end returns output parameter value based on signal', (done) => {
      context.environment.set('input', 'who');

      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', (activityApi, executionContext) => {
        executionContext.signal({input: 'me'});
      });

      task.once('end', (activityApi, executionContext) => {
        expect(executionContext.getOutput()).to.equal({
          userInput: 'me'
        });
        done();
      });

      task.inbound[0].take();
    });
  });

  describe('engine', () => {
    it('multiple inbound completes process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="testProcess" isExecutable="true">
          <startEvent id="start" />
          <userTask id="task" />
          <exclusiveGateway id="decision" default="flow3" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
          <sequenceFlow id="flow2" sourceRef="task" targetRef="decision" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="task" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression">\${output.taskInput.decision.defaultTaken}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activity) => {
        startCount++;
        if (startCount > 2) {
          fail(`<${activity.id}> Too many starts`);
        }
      });

      listener.on('wait-task', (activityApi) => {
        activityApi.signal();
      });

      listener.on('start-decision', (activityApi) => {
        activityApi.signal({defaultTaken: true});
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

    it('user signal input is stored with process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <userTask id="task" />
          <endEvent id="theEnd" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="task" />
          <sequenceFlow id="flow2" sourceRef="task" targetRef="theEnd" />
        </process>
      </definitions>`;
      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      listener.once('wait-task', (activityApi) => {
        activityApi.signal('Pål');
      });

      engine.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });

      engine.on('end', (execution) => {
        expect(execution.getOutput().taskInput.task).to.equal('Pål');
        done();
      });
    });

    it('but not if signal is called without input', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <userTask id="task" />
          <endEvent id="theEnd" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="task" />
          <sequenceFlow id="flow2" sourceRef="task" targetRef="theEnd" />
        </process>
      </definitions>`;
      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      listener.once('wait-task', (activityApi) => {
        activityApi.signal();
      });

      engine.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);
      });

      engine.on('end', (execution) => {
        expect(execution.getOutput().taskInput).to.be.undefined();
        done();
      });
    });
  });

  describe('loop', () => {
    describe('sequential', () => {
      let context;
      beforeEach((done) => {
        getLoopContext(true, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      it('emits wait with the same id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const waits = [];
        task.on('wait', (activityApi, executionContext) => {
          if (waits.length > 5) fail('too many waits');
          waits.push(executionContext.id);
          executionContext.signal();
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          done();
        });

        task.run();
      });

      it('resume resumes incomple executions', (done) => {
        const task = context.getChildActivityById('task');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        const waits = [];
        task.on('wait', (activityApi, executionContext) => {
          waits.push(executionContext.id);
          executionContext.signal();
        });

        task.on('start', function startEH() {
          ++count;

          if (count < 2) return;
          task.removeListener('start', startEH);

          state = taskApi.getState();
          taskApi.stop();

          task.on('start', () => {
            ++count;
            if (count > 4) fail('Too many starts');
          });
          task.on('leave', () => {
            expect(waits).to.have.length(3);
            done();
          });

          task.activate(state).resume();
        });

        task.activate().run();
      });

    });

    describe('parallell', () => {
      let context;
      beforeEach((done) => {
        getLoopContext(false, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      it('emits wait with different ids', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        const waits = [];
        task.on('wait', (activityApi, executionContext) => {
          if (waits.length > 5) fail('too many waits');

          starts.push(executionContext);
          waits.push(executionContext.id);

          if (starts.length === 3) {
            starts.reverse().forEach((t) => t.signal());
          }
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(waits).to.have.length(3);
          waits.forEach((id) => expect(id).to.match(/^task_/i));
          expect(waits.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      it('assigns input to form', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('wait', (activityApi, executionContext) => {
          executionContext.signal();
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          done();
        });

        task.run();
      });
    });
  });
});

function getLoopContext(sequential, callback) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="parallellLoopProcess" isExecutable="true">
      <userTask id="task">
        <multiInstanceLoopCharacteristics isSequential="${sequential}">
          <loopCardinality>3</loopCardinality>
        </multiInstanceLoopCharacteristics>
      </userTask>
    </process>
  </definitions>`;

  testHelpers.getContext(source, callback);
}
