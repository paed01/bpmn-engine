'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('SubProcess', () => {
  describe('events', () => {
    const source = factory.resource('sub-process.bpmn').toString();
    let context;

    beforeEach(async () => {
      context = await testHelpers.context(source);
    });

    it('emits start on inbound taken', (done) => {
      const subProcess = context.getChildActivityById('subProcess');
      subProcess.activate();

      subProcess.once('start', () => {
        done();
      });

      subProcess.inbound[0].take();
    });

    it('emits end when completed', (done) => {
      const listener = new EventEmitter();
      context.environment.setListener(listener);

      const subProcess = context.getChildActivityById('subProcess');

      subProcess.activate();

      listener.once('wait-subUserTask', (activityApi) => {
        activityApi.signal();
      });

      subProcess.once('end', () => {
        done();
      });

      subProcess.inbound[0].take();
    });

  });

  describe('engine', () => {
    const source = factory.resource('sub-process.bpmn').toString();

    it('completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (activityApi) => {
        activityApi.signal();
      });

      const engine = new Engine({
        source
      });
      engine.execute({
        listener,
        variables: {
          input: 1
        }
      });

      engine.on('end', () => {
        done();
      });
    });

    it('cancel sub process discards outbound and completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (taskApi, subProcessInstance) => {
        subProcessInstance.cancel();
      });

      const engine = new Engine({
        source
      });
      engine.execute({
        listener,
        variables: {
          input: 0
        }
      });

      engine.on('end', (execution, definition) => {
        expect(definition.getChildState('theEnd').taken, 'theEnd taken').to.be.undefined();
        expect(definition.getChildState('subProcess').entered, 'subProcess entered').to.be.undefined();
        expect(definition.getChildState('subProcess').cancelled, 'subProcess canceled').to.be.true();
        testHelpers.expectNoLingeringListenersOnDefinition(definition);
        testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
        done();
      });
    });

    it('cancelled sub activity takes outbound and completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.once('wait-subUserTask', (activityApi) => {
        activityApi.signal();
      });
      listener.once('start-subScriptTask', (activityApi) => {
        activityApi.cancel();
      });

      const engine = new Engine({
        source
      });
      engine.execute({
        listener,
        variables: {
          input: 127
        }
      });

      engine.once('end', (execution, definition) => {
        expect(definition.getChildState('theEnd').taken, 'theEnd taken').to.be.true();
        expect(definition.getChildState('subProcess').cancelled, 'subProcess canceled').to.be.undefined();
        expect(definition.getChildState('subProcess').taken, 'subProcess taken').to.be.true();

        testHelpers.expectNoLingeringListenersOnEngine(engine);
        testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
        done();
      });
    });
  });

  describe('error', () => {
    it('emits error if sub task fails', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <subProcess id="subProcess" name="Wrapped">
            <serviceTask id="subServiceTask" name="Put" implementation="\${services.throw}" />
          </subProcess>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        services: {
          throw: (context, next) => {
            next(new Error('Expected'));
          }
        }
      });

      engine.on('error', (thrownErr) => {
        expect(thrownErr).to.be.an.error('Expected');
        done();
      });
    });

    it('returns error in execute callback', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <subProcess id="subProcess" name="Wrapped">
            <serviceTask id="subServiceTask" name="Put" implementation="\${services.throw}" />
          </subProcess>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        services: {
          throw: (context, next) => {
            next(new Error('Expected'));
          }
        }
      }, (err) => {
        expect(err).to.be.an.error('Expected');
        done();
      });
    });

    it('catches error if bound error event is attached', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <subProcess id="subProcess" name="Wrapped">
            <serviceTask id="subServiceTask" name="Put" implementation="\${services.throw}" />
          </subProcess>
          <boundaryEvent id="errorEvent" attachedToRef="subProcess">
            <errorEventDefinition errorRef="Error_def" />
          </boundaryEvent>
        </process>
        <error id="Error_def" name="SubProcessError" errorCode="\${message}" />
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        services: {
          throw: (context, next) => {
            next(new Error('Expected'));
          }
        }
      }, (err) => {
        if (err) return done(err);
      });

      engine.on('end', (execution) => {
        expect(execution.getOutput().taskInput.errorEvent).to.equal({
          errorCode: 'Expected',
          errorMessage: 'Expected'
        });
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
        const task = context.getChildActivityById('sub-process-task');
        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts).to.be.equal(['sub-process-task', 'sub-process-task', 'sub-process-task']);
          done();
        });

        task.run();
      });

      it('assigns input', (done) => {
        const listener = new EventEmitter();
        context.environment.setListener(listener);

        const task = context.getChildActivityById('sub-process-task');
        const taskApi = task.activate(null, listener);

        const doneTasks = [];
        listener.on('end-serviceTask', (activityApi) => {
          doneTasks.push(activityApi.getInput().item);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);

          done();
        });

        taskApi.run();
      });

      it.skip('resume', (done) => {
        const listener = new EventEmitter();
        context.environment.setListener(listener);

        const task = context.getChildActivityById('sub-process-task');
        const taskApi = task.activate(null, listener);

        const doneTasks = [];
        listener.on('end-serviceTask', (activityApi) => {
          doneTasks.push(activityApi.getInput().item);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);
          done();
        });

        taskApi.run();
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
        const task = context.getChildActivityById('sub-process-task');

        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      it('assigns loop input to sub task', (done) => {
        const listener = new EventEmitter();
        context.environment.setListener(listener);

        const task = context.getChildActivityById('sub-process-task');
        const taskApi = task.activate();

        const doneTasks = [];
        listener.on('end-serviceTask', (activityApi) => {
          doneTasks.push(activityApi.getInput().item);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);
          done();
        });

        taskApi.run();
      });
    });
  });
});

function getLoopContext(sequential, callback) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="sequentialLoopProcess" isExecutable="true">
    <subProcess id="sub-process-task" name="Wrapped">
      <multiInstanceLoopCharacteristics isSequential="${sequential}">
        <loopCardinality>\${variables.inputList.length}</loopCardinality>
      </multiInstanceLoopCharacteristics>
      <serviceTask id="serviceTask" name="Put" implementation="\${services.loop(variables.inputList,index)}" />
    </subProcess>
    </process>
  </definitions>`;
  testHelpers.getContext(source, (err, context) => {
    if (err) return callback(err);
    context.environment.set('prefix', 'sub');
    context.environment.set('inputList', ['labour', 'archiving', 'shopping']);

    context.environment.addService('loop', function getLoop(list, idx) {
      this.setInputValue('item', list[idx]);
      return function loop(inputContext, next) {
        next(null, list[idx]);
      };
    });

    callback(null, context);
  });
}
