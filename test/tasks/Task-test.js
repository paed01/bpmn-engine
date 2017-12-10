'use strict';

const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../lib');
const {EventEmitter} = require('events');

describe('Task', () => {
  describe('behaviour', () => {
    const source = `
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
    beforeEach(async () => {
      context = await testHelpers.context(source);
    });

    describe('activate()', () => {
      it('returns activity api', () => {
        const task = context.getChildActivityById('task');
        const activityApi = task.activate();
        expect(activityApi).to.be.ok;
      });

      it('activity api has the expected properties', () => {
        const task = context.getChildActivityById('task');
        const activityApi = task.activate();
        expect(activityApi).to.include({
          id: 'task',
          type: 'bpmn:Task'
        });
        expect(activityApi.inbound).to.be.an('array').and.have.length(1);
        expect(activityApi.outbound).to.be.an('array').and.have.length(1);
      });

      it('activity api has the expected functions', () => {
        const task = context.getChildActivityById('task');
        const activityApi = task.activate();
        expect(activityApi.run, 'run').to.be.a('function');
        expect(activityApi.deactivate, 'deactivate').to.be.a('function');
        expect(activityApi.execute, 'execute').to.be.a('function');
        expect(activityApi.getState, 'getState').to.be.a('function');
        expect(activityApi.resume, 'resume').to.be.a('function');
        expect(activityApi.getApi, 'getApi').to.be.a('function');
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
          expect.fail('No start should happen');
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
          expect(eventNames).to.eql(['start']);
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
          expect(eventNames).to.eql(['start', 'end']);
          done();
        });

        task.inbound[0].take();
      });


      it('can be stopped on start', (done) => {
        const engine = Engine({
          source
        });

        const listener = new EventEmitter();
        listener.on('start-task', () => {
          engine.stop();
        });
        listener.once('end-task', () => {
          expect.fail('should have been stopped');
        });
        engine.execute({listener}, done);
      });
    });

    describe('resume', () => {
      it('can be stopped on start', (done) => {
        const engine = Engine({
          source
        });

        const listener = new EventEmitter();
        let state;
        listener.on('start-task', () => {
          engine.stop();
        });
        listener.once('end-task', () => {
          expect.fail('should have been stopped');
        });
        engine.execute({listener}, resume);

        function resume(err) {
          if (err) return done(err);

          state = engine.getState();

          const resumeListener = new EventEmitter();
          const resumedExecution = Engine.resume(state, {listener: resumeListener}, done);

          resumeListener.on('start-task', () => {
            resumedExecution.stop();
          });
          resumeListener.once('end-task', () => {
            expect.fail('should have been stopped');
          });
        }
      });
    });
  });

  describe('engine', () => {
    it('multiple inbound completes process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="testProcess" isExecutable="true">
          <startEvent id="start" />
          <task id="task" />
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
          expect.fail(`<${activity.id}> Too many starts`);
        }
      });

      listener.once('start-decision', (activityApi) => {
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

      it('emits start with the same id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts).to.be.eql(['task', 'task', 'task']);
          done();
        });

        task.run();
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

      it('emits start with different ids', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts.includes(task.id), 'unique task id').to.be.false;
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
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="sequentialLoopProcess" isExecutable="true">
      <task id="task">
        <multiInstanceLoopCharacteristics isSequential="${isSequential}">
          <loopCardinality>3</loopCardinality>
        </multiInstanceLoopCharacteristics>
      </task>
    </process>
  </definitions>`;
  testHelpers.getContext(source, (err, context) => {
    if (err) return callback(err);
    context.environment.set('analogue', ['labour', 'archiving', 'shopping']);
    callback(null, context);
  });
}
