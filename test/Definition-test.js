'use strict';

const {EventEmitter} = require('events');
const factory = require('./helpers/factory');
const Lab = require('lab');
const {Definition} = require('../lib/mapper');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {before, beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('Definition', () => {
  describe('new Definition()', () => {
    let moddleContext;
    before((done) => {
      testHelpers.getModdleContext(factory.valid('testingCtor'), (err, result) => {
        moddleContext = result;
        done(err);
      });
    });

    it('throws without arguments', (done) => {
      expect(() => {
        new Definition();
      }).to.throw(/No moddle context/);
      done();
    });

    it('takes moddle context as first argument', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.moddleContext).to.exist();
      done();
    });

    it('stores definition id on instance', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.id).to.equal('testingCtor');
      done();
    });

    it('stores environment on instance', (done) => {
      const definition = new Definition(moddleContext, {
        variables: {
          input: 1
        }
      });
      expect(definition.environment).to.be.an.object();
      done();
    });

    it('throws if options are invalid', (done) => {
      expect(() => {
        new Definition(moddleContext, {
          services: {
            invalid: {
              type: 'require'
            }
          }
        });
      }).to.throw(Error);
      done();
    });
  });

  describe('getProcesses()', () => {
    let definition;
    it('Given definition is initiated with two processes', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (merr, moddleContext) => {
        if (merr) return done(merr);
        definition = new Definition(moddleContext);
        done();
      });
    });

    it('returns processes from passed moddle context', (done) => {
      expect(definition.getProcesses().length).to.equal(2);
      done();
    });

    it('returns executable process in callback', (done) => {
      definition.getProcesses((err, mainProcess) => {
        if (err) return done(err);
        expect(mainProcess).to.exist();
        done();
      });
    });

    it('returns all processes in callback', (done) => {
      definition.getProcesses((err, mainProcess, processes) => {
        if (err) return done(err);
        expect(processes).to.exist();
        expect(processes.length).to.equal(2);
        done();
      });
    });

    it('returns error in callback if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.getProcesses((err) => {
          expect(err).to.be.an.error();
          done();
        });
      });
    });
  });

  describe('execute()', () => {
    it('emits error if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an.error();
          done();
        });

        def.execute();
      });
    });

    it('emits enter when first process enters', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = new Definition(moddleContext);
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

        const definition = new Definition(moddleContext);
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

        const definition = new Definition(moddleContext);
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

        const definition = new Definition(JSON.parse(testHelpers.serializeModdleContext(moddleContext)));
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

        const definition = new Definition(moddleContext);
        definition.once('end', () => {
          expect(activity, 'event listener').to.exist();
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

        const definition = new Definition(moddleContext, {
          listener: listener,
          variables: {
            input: 1
          }
        });
        definition.once('end', () => {
          expect(activity, 'event listener').to.exist();
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

        const definition = new Definition(moddleContext);

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

        const definition = new Definition(moddleContext);
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

        const def = new Definition(result);
        def.execute((err) => {
          expect(err).to.be.an.error();
          done();
        });
      });
    });

    it('emits error if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an.error();
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

        const def = new Definition(result);
        def.execute((err) => {
          expect(err).to.be.an.error();
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

        const def = new Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an.error();
          done();
        });
        def.execute();
      });
    });
  });

  describe('getState()', () => {
    const processXml = factory.userTask();
    let moddleContext;
    before((done) => {
      testHelpers.getModdleContext(processXml, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('returns state "pending" when not started yet', (done) => {
      const definition = new Definition(moddleContext);
      const state = definition.getState();
      expect(state.state).to.equal('pending');
      done();
    });

    it('returns state "running" when running', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

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
      const definition = new Definition(moddleContext);

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
      const definition = new Definition(moddleContext);

      listener.on('wait-userTask', () => {
        const state = definition.getState();
        expect(state.state).to.equal('running');
        expect(state.processes[state.entryPointId], `<${state.entryPointId}> state`).to.be.an.object();
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
      const definition = new Definition(moddleContext);

      listener.on('end-theProcess', () => {
        fail('Process should not complete');
      });

      listener.on('wait-userTask', () => {
        definition.stop();
        const state = definition.getState();
        expect(state.stopped).to.equal(true);
        done();
      });

      definition.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns processes variables and services', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

      listener.on('wait-userTask', () => {
        const state = definition.getState();
        expect(state.processes[state.entryPointId].environment, `<${definition.entryPointId}> variables`).to.include({
          variables: {
            input: 1
          },
          services: {
            request: {
              module: 'request'
            }
          }
        });
        done();
      });

      definition.execute({
        listener: listener,
        variables: {
          input: 1
        },
        services: {
          request: {
            module: 'request'
          }
        }
      }, (err) => {
        if (err) return done(err);
      });
    });
  });

  describe('getChildActivityById()', () => {
    let moddleContext;
    before((done) => {
      const processXml = factory.resource('lanes.bpmn');
      testHelpers.getModdleContext(processXml, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('returns child activity', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.getChildActivityById('task1')).to.exist();
      done();
    });

    it('returns child activity from participant process', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.getChildActivityById('completeTask')).to.exist();
      done();
    });

    it('returns undefined if activity is not found', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.getChildActivityById('whoAmITask')).to.be.undefined();
      done();
    });
  });

  describe('signal()', () => {
    let moddleContext;
    before((done) => {
      testHelpers.getModdleContext(factory.userTask('userTask1'), (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('signals child activity', (done) => {
      const definition = new Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait-userTask1', (task) => {
        expect(definition.signal(task.id, 'it´s me')).to.be.true();
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
      const definition = new Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait', () => {
        expect(definition.signal('madeUpId', 'who am I')).to.be.undefined();
        done();
      });

      definition.execute({
        listener: listener
      });
    });
  });

  describe('events', () => {
    describe('child error', () => {
      it('event callback returns error, child, process, and definition', (done) => {
        const source = `
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions id="testError" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
          <process id="theProcess" isExecutable="true">
            <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
          </process>
        </definitions>`;

        testHelpers.getModdleContext(source, {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }, (err, moddleContext) => {
          if (err) return done(err);

          const definition = new Definition(moddleContext);
          definition.once('error', (childErr, processExecution) => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            expect(childErr).to.be.an.error();
            expect(processExecution).to.exist();
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
    before((done) => {
      testHelpers.getModdleContext(factory.userTask(null, 'stopDef'), (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('sets stopped flag', (done) => {
      const definition = new Definition(moddleContext);
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

  });

  describe('Definition.resume()', () => {
    const source = factory.userTask(null, 'resumeDef');
    let moddleContext, state;
    before((done) => {
      testHelpers.getModdleContext(source, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });
    beforeEach((done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);
      listener.on('wait-userTask', () => {
        state = definition.getState();
        state.processes.theProcess.environment.variables.input = 'resumed';
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
        fail(`<${activity.id}> should not have been started`);
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
      const listener2 = new EventEmitter();

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      const definition2 = Definition.resume(testHelpers.readFromDb(state), {
        listener: listener2
      });
      definition2.once('end', () => {
        testHelpers.expectNoLingeringListenersOnDefinition(definition2);
        done();
      });
    });

    it('takes options', (done) => {
      const listener2 = new EventEmitter();

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      const definition2 = Definition.resume(testHelpers.readFromDb(state), {
        listener: listener2
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
          expect(err).to.be.an.error();
          done();
        });
      });
    });

    it('options is optional', (done) => {
      testHelpers.getModdleContext(factory.valid('immediateStop'), {}, (err, validModdleContext) => {
        if (err) return done(err);

        const listener = new EventEmitter();

        let startState;
        const definition1 = new Definition(validModdleContext);
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
          expect(error).to.be.an.error();
          done();
        });
      });
    });
  });

  describe('getPendingActivities()', () => {
    it('returns executing children', (done) => {
      testHelpers.getModdleContext(factory.valid(), {}, (err, validModdleContext) => {
        if (err) return done(err);
        const definition = new Definition(validModdleContext);
        expect(definition.getPendingActivities().children).to.have.length(0);
        done();
      });
    });

    it('returns empty children if not executing', (done) => {
      testHelpers.getModdleContext(factory.valid(), {}, (err, validModdleContext) => {
        if (err) return done(err);

        const listener = new EventEmitter();

        const definition = new Definition(validModdleContext);
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
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="parallellLoopProcess" isExecutable="true">
          <userTask id="task">
            <multiInstanceLoopCharacteristics isSequential="false" camunda:collection="\${variables.boardMembers}">
              <loopCardinality>5</loopCardinality>
            </multiInstanceLoopCharacteristics>
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="email">\${item}</camunda:inputParameter>
                <camunda:inputParameter name="index">\${index}</camunda:inputParameter>
              </camunda:inputOutput>
              <camunda:formData>
                <camunda:formField id="yay\${index}" type="boolean" />
              </camunda:formData>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;
      testHelpers.getModdleContext(source, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, moddleContext) => {
        if (err) return done(err);

        const listener = new EventEmitter();
        const definition = new Definition(moddleContext, {
          listener,
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
