'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');
const Definition = require('../lib/mapper').Definition;
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('Definition', () => {
  lab.experiment('new Definition()', () => {
    let moddleContext;
    lab.before((done) => {
      testHelpers.getModdleContext(factory.valid('testingCtor'), (err, result) => {
        moddleContext = result;
        done(err);
      });
    });

    lab.test('throws without arguments', (done) => {
      expect(() => {
        new Definition(); // eslint-disable-line no-new
      }).to.throw(/No moddle context/);
      done();
    });

    lab.test('takes moddle context as first argument', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.moddleContext).to.exist();
      done();
    });

    lab.test('stores definition id on instance', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.id).to.equal('testingCtor');
      done();
    });

    lab.test('stores options on instance', (done) => {
      const definition = new Definition(moddleContext, {
        variables: {
          input: 1
        }
      });
      expect(definition.options).to.be.an.object();
      done();
    });

    lab.test('throws if options are invalid', (done) => {
      expect(() => {
        new Definition(moddleContext, { // eslint-disable-line no-new
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

  lab.describe('getProcesses()', () => {
    let definition;
    lab.test('Given definition is initiated with two processes', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (merr, moddleContext) => {
        if (merr) return done(merr);
        definition = new Definition(moddleContext);
        done();
      });
    });

    lab.test('returns processes from passed moddle context', (done) => {
      expect(definition.getProcesses().length).to.equal(2);
      done();
    });

    lab.test('returns executable process in callback', (done) => {
      definition.getProcesses((err, mainProcess) => {
        if (err) return done(err);
        expect(mainProcess).to.exist();
        done();
      });
    });

    lab.test('returns all processes in callback', (done) => {
      definition.getProcesses((err, mainProcess, processes) => {
        if (err) return done(err);
        expect(processes).to.exist();
        expect(processes.length).to.equal(2);
        done();
      });
    });

    lab.test('passes options to initialized processes', (done) => {
      definition.getProcesses({
        variables: {
          input: 1
        }
      }, (err, mainProcess, processes) => {
        if (err) return done(err);
        expect(processes).to.exist();
        expect(processes.length).to.equal(2);
        expect(processes[0].context.variables.input).to.equal(1);
        expect(processes[1].context.variables.input).to.equal(1);
        done();
      });
    });

    lab.test('emits error if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.once('error', (err) => {
          expect(err).to.be.an.error();
          done();
        });

        def.getProcesses();
      });
    });

    lab.test('returns error in callback if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.getProcesses((err) => {
          expect(err).to.be.an.error();
          done();
        });
      });
    });

    lab.test('returns running processes in callback if started regardless of options', (done) => {
      testHelpers.getModdleContext(factory.userTask(), (merr, result) => {
        if (merr) return done(merr);

        const listener = new EventEmitter();
        const def = new Definition(result, {
          listener: listener,
          variables: {
            input: 1
          }
        });
        listener.once('wait', () => {
          def.getProcesses({
            variables: {
              input: 2
            }
          }, (err, mainProcess) => {
            if (err) return done(err);
            expect(mainProcess.listener).to.equal(listener);
            expect(mainProcess.context.variables.input).to.equal(1);
            done();
          });
        });
        def.execute();

      });
    });

    lab.test('returns running processes if started regardless of options', (done) => {
      testHelpers.getModdleContext(factory.userTask(), (merr, result) => {
        if (merr) return done(merr);

        const listener = new EventEmitter();
        const def = new Definition(result, {
          listener: listener,
          variables: {
            input: 1
          }
        });
        listener.once('wait', () => {
          const processes = def.getProcesses({
            variables: {
              input: 2
            }
          });
          expect(processes[0].listener).to.equal(listener);
          expect(processes[0].context.variables.input).to.equal(1);
          done();
        });
        def.execute();
      });
    });

  });

  lab.describe('execute()', () => {
    lab.test('emits end when all processes are completed', (done) => {
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

    lab.test('runs process with deserialized context', (done) => {
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

    lab.test('takes options as arguments', (done) => {
      testHelpers.getModdleContext(factory.valid(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const listener = new EventEmitter();
        let activity;
        listener.once('end-end2', (a) => {
          activity = a;
        });

        const definition = new Definition(moddleContext);
        definition.once('end', () => {
          expect(activity, 'event listener').to.exist();
          expect(definition.variables).to.include({
            input: 1
          });

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });

        definition.execute({
          listener: listener,
          variables: {
            input: 1
          }
        }, (err) => {
          if (err) return done(err);
        });
      });
    });

    lab.test('defaults to use ctor options', (done) => {
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
          expect(definition.variables).to.include({
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

    lab.test('throws if options are invalid', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = new Definition(moddleContext);

        function testFn() {
          definition.execute({
            listener: {}
          });
        }

        expect(testFn).to.throw(Error, /\"emit\" function is required/);
        done();
      });
    });

    lab.test('exposes services option to participant processes', (done) => {
      testHelpers.getModdleContext(factory.resource('mother-of-all.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const definition = new Definition(moddleContext);
        const listener = new EventEmitter();

        listener.on('wait', (activity) => {
          activity.signal({
            input: 1
          });
        });

        definition.once('end', () => {
          done();
        });

        definition.execute({
          services: {
            runService: {
              module: './test/helpers/testHelpers',
              fnName: 'serviceFn',
              type: 'require'
            }
          },
          variables: {
            input: 0
          },
          listener: listener
        }, (err) => {
          if (err) return done(err);
        });
      });
    });

    lab.test('returns error in callback if invalid moddleContext', (done) => {
      testHelpers.getModdleContext(factory.invalid(), (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.execute((err) => {
          expect(err).to.be.an.error();
          done();
        });
      });
    });

    lab.test('emits error if invalid moddleContext', (done) => {
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

    lab.test('returns error in callback if no executable process', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="false" />
</definitions>`;
      testHelpers.getModdleContext(processXml, (merr, result) => {
        if (merr) return done(merr);

        const def = new Definition(result);
        def.execute((err) => {
          expect(err).to.be.an.error();
          done();
        });
      });
    });

    lab.test('emits error if no executable process', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="false" />
</definitions>`;
      testHelpers.getModdleContext(processXml, (merr, result) => {
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

  lab.describe('getState()', () => {
    const processXml = factory.userTask();
    let moddleContext;
    lab.before((done) => {
      testHelpers.getModdleContext(processXml, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    lab.test('returns state "pending" when not started yet', (done) => {
      const definition = new Definition(moddleContext);
      const state = definition.getState();
      expect(state.state).to.equal('pending');
      done();
    });

    lab.test('returns state "running" when running', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

      listener.on('wait-userTask', () => {
        const state = definition.getState();
        expect(state.state).to.equal('running');
        done();
      });

      definition.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('returns state "completed" when completed', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

      listener.on('wait-userTask', (task) => {
        task.signal();
      });

      definition.once('end', () => {
        const state = definition.getState();
        expect(state.state).to.equal('completed');
        done();
      });

      definition.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('returns state of processes', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

      listener.on('wait-userTask', () => {
        const state = definition.getState();
        expect(state.state).to.equal('running');
        expect(state.processes[definition.entryPointId], `<${definition.entryPointId}> state`).to.be.an.object();
        expect(state.processes[definition.entryPointId], `<${definition.entryPointId}> state`).to.include({
          entered: true
        });
        done();
      });

      definition.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('returns stopped flag if stopped', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

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

    lab.test('returns processes variables and services', (done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);

      listener.on('wait-userTask', () => {
        const state = definition.getState();
        expect(state.processes[definition.entryPointId], `<${definition.entryPointId}> variables`).to.include({
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

  lab.describe('getChildActivityById()', () => {
    let moddleContext;
    lab.before((done) => {
      const processXml = factory.resource('lanes.bpmn');
      testHelpers.getModdleContext(processXml, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    lab.test('returns child activity', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.getChildActivityById('task1')).to.exist();
      done();
    });

    lab.test('returns child activity from participant process', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.getChildActivityById('meTooTask')).to.exist();
      done();
    });

    lab.test('throws if activity is not found', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.getChildActivityById('whoAmITask')).to.not.exist();
      done();
    });
  });

  lab.describe('signal()', () => {
    let moddleContext;
    lab.before((done) => {
      testHelpers.getModdleContext(factory.userTask('userTask1'), (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    lab.test('signals child activity', (done) => {
      const definition = new Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait', (task) => {
        expect(definition.signal(task.id, 'it´s me')).to.be.true();
      });

      definition.once('end', () => {
        expect(definition.variables.inputFromUser).to.equal('it´s me');
        done();
      });

      definition.execute({
        listener: listener
      });
    });

    lab.test('ignored if activity is not found by id', (done) => {
      const definition = new Definition(moddleContext);
      const listener = new EventEmitter();

      listener.once('wait', () => {
        expect(definition.signal('madeUpId', 'who am I')).to.be.false();
        done();
      });

      definition.execute({
        listener: listener
      });
    });
  });

  lab.describe('events', () => {
    lab.describe('child error', () => {
      lab.test('event callback returns error, child, process, and definition', (done) => {
        const defXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="testError" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
  </process>
</definitions>`
        ;

        testHelpers.getModdleContext(defXml, {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }, (err, moddleContext) => {
          if (err) return done(err);

          const definition = new Definition(moddleContext);
          definition.once('error', (childErr, child, processInstance, currentDef) => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            expect(childErr).to.be.an.error();
            expect(child).to.exist();
            expect(child.type).to.equal('bpmn:ServiceTask');
            expect(processInstance).to.exist();
            expect(processInstance.type).to.equal('bpmn:Process');
            expect(currentDef).to.shallow.equal(definition);
            done();
          });

          definition.execute();
        });

      });
    });
  });

  lab.describe('stop()', () => {
    let moddleContext;
    lab.before((done) => {
      testHelpers.getModdleContext(factory.userTask(null, 'stopDef'), (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    lab.test('sets stopped flag', (done) => {
      const definition = new Definition(moddleContext);
      const listener = new EventEmitter();
      listener.on('wait-userTask', () => {
        definition.stop();
      });
      definition.once('end', (def) => {
        expect(def.stopped).to.equal(true);
        done();
      });
      definition.execute({
        listener: listener,
        variables: {
          input: 'start'
        }
      }, (err) => {
        if (err) return done(err);
      });

    });

  });

  lab.describe('Definition.resume()', () => {
    const processXml = factory.userTask(null, 'resumeDef');
    let moddleContext, state;
    lab.before((done) => {
      testHelpers.getModdleContext(processXml, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });
    lab.beforeEach((done) => {
      const listener = new EventEmitter();
      const definition = new Definition(moddleContext);
      listener.on('wait-userTask', () => {
        state = definition.getState();
        state.processes.theProcess.variables.input = 'resumed';
        definition.stop();
      });
      definition.once('end', () => {
        done();
      });
      definition.execute({
        listener: listener,
        variables: {
          input: 'start'
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('starts with stopped task', (done) => {
      const listener2 = new EventEmitter();
      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

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

    lab.test('callback is optional', (done) => {
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

    lab.test('takes options', (done) => {
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

    lab.test('returns error in callback if the moddleContext is invalid (for some inexplicable reason)', (done) => {
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

    lab.test('options is optional', (done) => {
      testHelpers.getModdleContext(factory.valid('immediateStop'), {}, (err, validModdleContext) => {
        if (err) return done(err);

        const listener1 = new EventEmitter();

        let startState;
        const definition1 = new Definition(validModdleContext);
        listener1.once('enter-theStart', () => {
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
          listener: listener1
        });
      });
    });

    lab.test('resume failure emits error if no callback', (done) => {
      testHelpers.getModdleContext(factory.invalid(), {}, (merr, result) => {
        const definitionf = Definition.resume({
          id: 'who',
          moddleContext: result
        });
        definitionf.once('error', () => {
          done();
        });
      });
    });
  });

  lab.describe('getPendingActivities()', () => {
    lab.test('returns empty children if not loaded', (done) => {
      testHelpers.getModdleContext(factory.valid(), {}, (err, validModdleContext) => {
        if (err) return done(err);
        const definition = new Definition(validModdleContext);
        expect(definition.getPendingActivities().children).to.have.length(0);
        done();
      });
    });

  });
});
