'use strict';

const factory = require('./helpers/factory');
const testHelpers = require('./helpers/testHelpers');
const {Definition} = require('../lib/mapper');
const {EventEmitter} = require('events');

const extensions = {
  js: require('./resources/JsExtension')
};

describe('Definition', () => {
  describe('Definition()', () => {
    let moddleContext;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(factory.valid('testingCtor'));
    });

    it('throws if without arguments', () => {
      expect(() => {
        Definition();
      }).to.throw(/No moddle context/);
    });

    it('takes moddle context as first argument', () => {
      const definition = Definition(moddleContext);
      expect(definition.moddleContext).to.exist;
    });

    it('stores definition id on instance', () => {
      const definition = Definition(moddleContext);
      expect(definition.id).to.equal('testingCtor');
    });

    it('stores environment on instance', () => {
      const definition = Definition(moddleContext, {
        variables: {
          input: 1
        }
      });
      expect(definition.environment).to.be.an('object');
    });

    it('throws if options are invalid', () => {
      expect(() => {
        Definition(moddleContext, {
          services: {
            invalid: {
              type: 'require'
            }
          }
        });
      }).to.throw(Error);
    });
  });

  describe('getProcesses()', () => {
    let definition;
    it('Given definition is initiated with two processes', async () => {
      const moddleContext = await testHelpers.moddleContext(factory.resource('lanes.bpmn'));
      definition = Definition(moddleContext);
    });

    it('returns processes from passed moddle context', () => {
      expect(definition.getProcesses().length).to.equal(2);
    });

    it('returns executable process in callback', (done) => {
      definition.getProcesses((err, mainProcess) => {
        if (err) return done(err);
        expect(mainProcess).to.exist;
        done();
      });
    });

    it('returns all processes in callback', (done) => {
      definition.getProcesses((err, mainProcess, processes) => {
        if (err) return done(err);
        expect(processes).to.exist;
        expect(processes.length).to.equal(2);
        done();
      });
    });

    it('returns error in callback if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = Definition(result);
        def.getProcesses((err) => {
          expect(err).to.be.an('error');
          done();
        });
      });
    });
  });

  describe('execute()', () => {
    it('emits error if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an('error');
          done();
        });

        def.execute();
      });
    });

    it('emits enter when first process enters', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = Definition(moddleContext);
        let count = 0;
        definition.on('enter', () => {
          count++;
        });
        definition.on('end', () => {
          expect(count).to.equal(1);
          done();
        });

        definition.execute((err) => {
          if (err) return done(err);
        });
      });
    });

    it('emits start when first process has started', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = Definition(moddleContext);
        let count = 0;
        definition.on('start', () => {
          count++;
        });
        definition.on('end', () => {
          expect(count).to.equal(1);
          done();
        });

        definition.execute((err) => {
          if (err) return done(err);
        });
      });
    });

    it('emits end when all processes are completed', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = Definition(moddleContext);
        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });

        definition.execute((err) => {
          if (err) return done(err);
        });
      });

    });

    it('runs process with deserialized context', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = Definition(JSON.parse(testHelpers.serializeModdleContext(moddleContext)));
        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });

        definition.execute((err) => {
          if (err) return done(err);
        });
      });
    });

    it('takes options as arguments', (done) => {
      testHelpers.getModdleContext(factory.valid(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const listener = new EventEmitter();
        let activity;
        listener.once('end-end2', (activityApi) => {
          activity = activityApi;
        });

        const definition = Definition(moddleContext);
        definition.once('end', () => {
          expect(activity, 'event listener').to.exist;
          expect(definition.environment.variables).to.include({
            input: 1
          });

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });

        definition.execute({
          listener,
          variables: {
            input: 1
          }
        }, (err) => {
          if (err) return done(err);
        });
      });
    });

    it('defaults to use ctor options', (done) => {
      testHelpers.getModdleContext(factory.valid(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const listener = new EventEmitter();
        let activity;
        listener.once('end-end2', (a) => {
          activity = a;
        });

        const definition = Definition(moddleContext, {
          listener,
          variables: {
            input: 1
          }
        });
        definition.once('end', () => {
          expect(activity, 'event listener').to.exist;
          expect(definition.environment.variables).to.include({
            input: 1
          });

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });

        definition.execute((err) => {
          if (err) return done(err);
        });
      });
    });

    it('throws if options are invalid', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = Definition(moddleContext);

        function testFn() {
          definition.execute({
            listener: {}
          });
        }

        expect(testFn).to.throw(Error, /"emit" function is required/);
        done();
      });
    });

    it('exposes services option to participant processes', (done) => {
      testHelpers.getModdleContext(factory.resource('mother-of-all.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = Definition(moddleContext);
        const listener = new EventEmitter();

        listener.on('wait', (activityApi) => {
          if (activityApi.type !== 'bpmn:UserTask') return;
          activityApi.signal({
            input: 1
          });
        });

        definition.once('end', () => {
          done();
        });

        definition.execute({
          listener,
          services: {
            runService: {
              module: './test/helpers/testHelpers',
              fnName: 'serviceFn',
              type: 'require'
            }
          },
          variables: {
            input: 0
          }
        }, (err) => {
          if (err) return done(err);
        });
      });
    });

    it('returns error in callback if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = Definition(result);
        def.execute((err) => {
          expect(err).to.be.an('error');
          done();
        });
      });
    });

    it('emits error if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an('error');
          done();
        });
        def.execute();
      });
    });

    it('returns error in callback if no executable process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="false" />
      </definitions>`;
      testHelpers.getModdleContext(source, (merr, result) => {
        if (merr) return done(merr);

        const def = Definition(result);
        def.execute((err) => {
          expect(err).to.be.an('error');
          done();
        });
      });
    });

    it('emits error if no executable process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="false" />
      </definitions>`;
      testHelpers.getModdleContext(source, (merr, result) => {
        if (merr) return done(merr);

        const def = Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an('error');
          done();
        });
        def.execute();
      });
    });
  });

  describe('getState()', () => {
    const source = factory.userTask();
    let moddleContext;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(source);
    });

    it('returns state "pending" when not started yet', () => {
      const definition = Definition(moddleContext);
      const state = definition.getState();
      expect(state.state).to.equal('pending');
    });

    it('returns state "running" when running', (done) => {
      const listener = new EventEmitter();
      const definition = Definition(moddleContext);

      definition.on('start', (executionApi) => {
        const state = executionApi.getState();
        expect(state.state).to.equal('running');
        done();
      });

      definition.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns state "completed" when completed', (done) => {
      const listener = new EventEmitter();
      const definition = Definition(moddleContext);

      listener.on('wait-userTask', (task) => {
        task.signal();
      });

      definition.once('end', (executionApi) => {
        const state = executionApi.getState();
        expect(state.state).to.equal('completed');
        done();
      });

      definition.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns state of processes', (done) => {
      const listener = new EventEmitter();
      const definition = Definition(moddleContext);

      listener.on('wait-userTask', () => {
        const state = definition.getState();
        expect(state.state).to.equal('running');
        expect(state.processes[state.entryPointId], `<${state.entryPointId}> state`).to.be.an('object');
        expect(state.processes[state.entryPointId], `<${state.entryPointId}> state`).to.include({
          entered: true
        });
        done();
      });

      definition.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns stopped flag if stopped', (done) => {
      const listener = new EventEmitter();
      const definition = Definition(moddleContext);

      listener.on('end-theProcess', () => {
        expect.fail('Process should not complete');
      });

      listener.on('wait-userTask', () => {
        definition.stop();
        const state = definition.getState();
        expect(state.stopped).to.equal(true);
        done();
      });

      definition.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });
    });
  });

  describe('getChildActivityById()', () => {
    let moddleContext;
    before(async () => {
      const source = factory.resource('lanes.bpmn');
      moddleContext = await testHelpers.moddleContext(source);
    });

    it('returns child activity', () => {
      const definition = Definition(moddleContext);
      expect(definition.getChildActivityById('task1')).to.exist;
    });

    it('returns child activity from participant process', () => {
      const definition = Definition(moddleContext);
      expect(definition.getChildActivityById('completeTask')).to.exist;
    });

    it('returns undefined if activity is not found', () => {
      const definition = Definition(moddleContext);
      expect(definition.getChildActivityById('whoAmITask')).to.be.undefined;
    });
  });

  describe('getChildState()', () => {
    let moddleContext;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(factory.userTask('userTask1'));
    });

    it('returns child activity state', (done) => {
      const definition = Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait-userTask1', (task) => {
        expect(definition.getChildState(task.id).waiting).to.be.true;
        done();
      });

      definition.execute({
        listener
      });
    });

    it('returns nothing if not running', () => {
      const definition = Definition(moddleContext);
      expect(definition.getChildState('userTask1')).to.be.undefined;
    });
  });

  describe('signal()', () => {
    let moddleContext;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(factory.userTask('userTask1'));
    });

    it('signals child activity', (done) => {
      const definition = Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait-userTask1', (task) => {
        expect(definition.signal(task.id, {input: 'it´s me'})).to.be.true;
      });

      definition.once('end', () => {
        expect(definition.environment.variables).to.include({
          inputFromUser: 'it´s me'
        });
        done();
      });

      definition.execute({
        listener
      });
    });

    it('ignored if activity is not found by id', (done) => {
      const definition = Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait', () => {
        expect(definition.signal('madeUpId', 'who am I')).to.be.undefined;
        done();
      });

      definition.execute({
        listener
      });
    });

    it('ignored if not running', () => {
      const definition = Definition(moddleContext);
      definition.signal();
    });
  });

  describe('events', () => {
    describe('child error', () => {
      it('error event handler returns error, child, process execution', (done) => {
        const source = `
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions id="testError" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <process id="theProcess" isExecutable="true">
            <serviceTask id="serviceTask" name="Get" implementation="\${services.get}" />
          </process>
        </definitions>`;

        testHelpers.getModdleContext(source, null, (err, moddleContext) => {
          if (err) return done(err);

          const definition = Definition(moddleContext);

          definition.once('error', (childErr, processExecution) => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            expect(childErr).to.be.an('error').and.match(/did not resolve to a function/i);
            expect(processExecution).to.exist;
            expect(processExecution.type).to.equal('bpmn:Process');
            done();
          });

          definition.execute();
        });

      });
    });
  });

  describe('stop()', () => {
    let moddleContext;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(factory.userTask(null, 'stopDef'));
    });

    it('sets stopped flag', (done) => {
      const definition = Definition(moddleContext);
      const listener = new EventEmitter();
      listener.on('wait-userTask', () => {
        definition.stop();
      });
      definition.once('end', (def) => {
        expect(def.getState().stopped).to.equal(true);
        done();
      });
      definition.execute({
        listener,
        variables: {
          input: 'start'
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('ignored if not executing', () => {
      const definition = Definition(moddleContext);
      definition.stop();
    });
  });

  describe('resume()', () => {
    const source = factory.userTask(null, 'resumeDef');
    let moddleContext, state;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(source);
    });

    beforeEach((done) => {
      const listener = new EventEmitter();
      const definition = Definition(moddleContext);
      listener.on('wait-userTask', () => {
        state = definition.getState();
        state.processes.theProcess.environment.variables = {input: 'resumed'};
        definition.stop();
      });
      definition.once('end', () => {
        done();
      });
      definition.execute({
        listener,
        variables: {
          input: 'start'
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('starts with stopped task', (done) => {
      const listener = new EventEmitter();
      listener.once('start-theStart', (activity) => {
        expect.fail(`<${activity.id}> should not have been started`);
      });

      listener.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      const definition2 = Definition.resume(testHelpers.readFromDb(state), {
        listener
      }, (err) => {
        if (err) return done(err);
      });

      definition2.once('end', () => {
        testHelpers.expectNoLingeringListenersOnDefinition(definition2);
        done();
      });
    });

    it('callback is optional', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      const definition2 = Definition.resume(testHelpers.readFromDb(state), {
        listener
      });
      definition2.once('end', () => {
        testHelpers.expectNoLingeringListenersOnDefinition(definition2);
        done();
      });
    });

    it('takes options', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      const definition2 = Definition.resume(testHelpers.readFromDb(state), {
        listener
      }, (err) => {
        if (err) return done(err);
      });

      definition2.once('end', () => {
        testHelpers.expectNoLingeringListenersOnDefinition(definition2);
        done();
      });
    });

    it('returns error in callback if the moddleContext is invalid (for some inexplicable reason)', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, invalidContext) => {
        const invalidState = Object.assign({}, state, {
          moddleContext: invalidContext
        });

        Definition.resume(invalidState, (err) => {
          expect(err).to.be.an('error');
          done();
        });
      });
    });

    it('options is optional', (done) => {
      testHelpers.getModdleContext(factory.valid('immediateStop'), {}, (err, validModdleContext) => {
        if (err) return done(err);

        const listener = new EventEmitter();

        let startState;
        const definition1 = Definition(validModdleContext);
        listener.once('enter-theStart', () => {
          startState = definition1.getState();
          definition1.stop();
        });

        definition1.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition1);
          const definition2 = Definition.resume(startState);
          definition2.once('end', () => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition2);
            done();
          });
        });

        definition1.execute({
          listener
        });
      });
    });

    it('resume failure emits error if no callback', (done) => {
      testHelpers.getModdleContext(factory.invalid(), {}, (merr, result) => {
        const definitionf = Definition.resume({
          id: 'who',
          moddleContext: result
        });
        definitionf.once('error', (error) => {
          expect(error).to.be.an('error');
          done();
        });
      });
    });
  });

  describe('getPendingActivities()', () => {
    it('returns no executing children if not running', async () => {
      const validModdleContext = await testHelpers.moddleContext(factory.valid());
      const definition = Definition(validModdleContext);
      expect(definition.getPendingActivities().children).to.have.length(0);
    });

    it('returns empty children if not executing', (done) => {
      testHelpers.getModdleContext(factory.valid(), {}, (err, validModdleContext) => {
        if (err) return done(err);

        const listener = new EventEmitter();

        const definition = Definition(validModdleContext);
        listener.once('enter-theStart', () => {
          const pending = definition.getPendingActivities();
          expect(pending.state).to.equal('running');

          definition.stop();
          done();
        });

        definition.execute({
          listener
        });
      });
    });

    it('with parallel task loop returns pending tasks including loop', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
        <process id="parallellLoopProcess" isExecutable="true">
          <userTask id="task">
            <multiInstanceLoopCharacteristics isSequential="false" js:collection="\${variables.boardMembers}">
              <loopCardinality>5</loopCardinality>
            </multiInstanceLoopCharacteristics>
          </userTask>
        </process>
      </definitions>`;
      testHelpers.getModdleContext(source, {js: extensions.js.moddleOptions}, (err, moddleContext) => {
        if (err) return done(err);

        const listener = new EventEmitter();
        const definition = Definition(moddleContext, {
          listener,
          extensions,
          variables: {
            boardMembers: ['pal@example.com', 'franz@example.com', 'immanuel@example.com']
          }
        });

        let count = 0;
        listener.on('wait', () => {
          ++count;
          if (count < 3) return;

          const pending = definition.getPendingActivities();
          expect(pending.children.length, 'pending activities count').to.equal(4);

          pending.children.forEach((c) => {
            if (c.signal) c.signal();
          });
        });

        definition.execute(done);
      });
    });
  });
});
