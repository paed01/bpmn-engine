'use strict';

const Code = require('code');
const BpmnModdle = require('bpmn-moddle');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('..');

lab.experiment('Engine', () => {
  lab.test('Bpmn exposes Engine', (done) => {
    expect(Bpmn).to.include('Engine');
    done();
  });
  lab.test('Bpmn exposes Defintion', (done) => {
    expect(Bpmn).to.include('Definition');
    done();
  });
  lab.test('Bpmn exposes transformer', (done) => {
    expect(Bpmn).to.include('transformer');
    done();
  });
  lab.test('Bpmn exposes validation', (done) => {
    expect(Bpmn).to.include('validation');
    done();
  });

  lab.experiment('ctor', () => {
    lab.test('without arguments', (done) => {
      expect(() => {
        new Bpmn.Engine(); // eslint-disable-line no-new
      }).to.not.throw();
      done();
    });

    lab.test('takes source option', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      expect(engine.sources).to.exist();
      expect(engine.sources.length).to.equal(1);
      done();
    });

    lab.test('throws if unsupported option is passed', (done) => {
      expect(() => {
        new Bpmn.Engine({ // eslint-disable-line no-new
          context: {}
        });
      }).to.throw();
      done();
    });

    lab.test('takes moddleOptions as option', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid(),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      expect(engine.moddleOptions).to.exist();
      done();
    });

    lab.test('accepts source as Buffer', (done) => {
      const buff = new Buffer(factory.valid());
      const engine = new Bpmn.Engine({
        name: 'source from buffer',
        source: buff
      });
      engine.execute((err) => {
        expect(err).to.not.exist();
        done();
      });
    });

    lab.test('but not function', (done) => {
      const source = () => {};
      expect(() => {
        new Bpmn.Engine({ // eslint-disable-line no-new
          source: source
        });
      }).to.throw();
      done();
    });

    lab.test('accepts name', (done) => {
      let engine;
      expect(() => {
        engine = new Bpmn.Engine({ // eslint-disable-line no-new
          name: 'no source'
        });
      }).to.not.throw();

      expect(engine.name).to.equal('no source');

      done();
    });
  });

  lab.experiment('getDefinition()', () => {
    lab.test('returns definition of passed moddle context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.valid('contextTest'), (moddleErr, definition, moddleContext) => {
        if (moddleErr) return done(moddleErr);
        const engine = new Bpmn.Engine({
          moddleContext: moddleContext
        });
        engine.getDefinition((err) => {
          if (err) return done(err);
          expect(engine.getDefinitionById('contextTest')).to.exist();
          done();
        });
      });
    });

    lab.test('returns definition of passed deserialized moddle context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.valid('contextTest'), (moddleErr, definition, context) => {
        if (moddleErr) return done(moddleErr);
        const engine = new Bpmn.Engine({
          moddleContext: JSON.parse(testHelpers.serializeModdleContext(context))
        });
        engine.getDefinition((err) => {
          if (err) return done(err);
          expect(engine.getDefinitionById('contextTest')).to.exist();
          done();
        });
      });
    });

    lab.test('returns error in callback if invalid definition', (done) => {
      const engine = new Bpmn.Engine({
        source: 'not xml'
      });
      engine.getDefinition((err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns undefined in callback if no definitions', (done) => {
      const engine = new Bpmn.Engine();
      engine.getDefinition((err, def) => {
        expect(err).not.to.exist();
        expect(def).not.to.exist();
        done();
      });
    });
  });

  lab.describe('execute()', () => {
    lab.test('without arguments runs process', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      engine.once('end', () => {
        done();
      });

      engine.execute();
    });

    lab.test('returns error in callback if no source', (done) => {
      const engine = new Bpmn.Engine({
        source: ''
      });
      engine.execute((err) => {
        expect(err).to.be.an.error(/nothing to execute/i);
        done();
      });
    });

    lab.test('returns error in callback if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.execute((err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('emits error if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.once('error', (err) => {
        expect(err).to.be.an.error();
        done();
      });

      engine.execute();
    });

    lab.test('returns error in callback if no executable process', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="false" />
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err) => {
        expect(err).to.be.an.error(/no executable process/);
        done();
      });
    });

    lab.test('emits error if called with invalid definition and no callback', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="false" />
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.once('error', (err) => {
        expect(err).to.be.an.error(/no executable process/);
        done();
      });

      engine.execute();
    });

    lab.test('emits end when all processes are completed', (done) => {
      const engine = new Bpmn.Engine({
        name: 'end test',
        source: factory.resource('lanes.bpmn')
      });
      engine.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.execute((err) => {
        if (err) return done(err);
      });
    });

    lab.test('emits error if execution fails', (done) => {
      const engine = new Bpmn.Engine({
        name: 'end test',
        source: `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
  </process>
</definitions>`,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      engine.once('error', (err) => {
        expect(err).to.be.an.error('Inner error');
        expect(engine.started).to.be.false();
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.execute({
        services: {
          get: (context, next) => {
            next(new Error('Inner error'));
          }
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('runs process with deserialized context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.resource('lanes.bpmn').toString(), (moddleErr, definition, context) => {
        if (moddleErr) return done(moddleErr);

        const engine = new Bpmn.Engine({
          name: 'deserialized context',
          moddleContext: JSON.parse(testHelpers.serializeModdleContext(context))
        });
        engine.once('end', () => {
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });

        engine.execute((err) => {
          if (err) return done(err);
        });
      });
    });

    lab.describe('execute options', () => {
      lab.test('throws error if listener doesn´t have an emit function', (done) => {
        const engine = new Bpmn.Engine({
          source: factory.resource('lanes.bpmn')
        });

        function testFn() {
          engine.execute({
            listener: {}
          });
        }

        expect(testFn).to.throw(Error, /\"emit\" function is required/);
        done();
      });

      lab.test('returns error in callback if service type is not "global" or "require"', (done) => {
        const engine = new Bpmn.Engine({
          source: factory.resource('lanes.bpmn')
        });

        function testFn() {
          engine.execute({
            services: {
              test: {
                module: 'require',
                type: 'misc'
              }
            }
          });
        }

        expect(testFn).to.throw(Error, /must be global or require/);
        done();
      });
    });

    lab.test('exposes services to participant processes', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.resource('mother-of-all.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait', (activity) => {
        activity.signal({
          input: 1
        });
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
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

  lab.describe('getState()', () => {
    const processXml = factory.userTask();

    lab.test('returns state "running" when running definitions', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
        expect(state).to.be.an.object();
        expect(state).to.include({
          state: 'running'
        });
        done();
      });

      engine.execute({
        listener: listener,
        variables: {
          input: null
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('returns state "idle" when nothing is running', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });

      const state = engine.getState();

      expect(state).to.be.an.object();
      expect(state).to.include({
        state: 'idle',
        definitions: []
      });
      done();
    });

    lab.test('returns state of running definitions', (done) => {
      const engine = new Bpmn.Engine({
        name: 'running',
        source: processXml
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
        expect(state.name).to.equal('running');
        expect(state.definitions).to.have.length(1);
        expect(state.definitions[0]).to.be.an.object();
        expect(state.definitions[0].processes).to.be.an.object();
        done();
      });

      engine.execute({
        listener: listener,
        variables: {
          input: null
        }
      }, (err) => {
        if (err) return done(err);
      });
    });
  });

  lab.describe('Engine.resume()', () => {
    let engineState;
    lab.before((done) => {
      const engine = new Bpmn.Engine({
        name: 'test resume',
        source: factory.userTask()
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        engineState = engine.getState();
        engine.stop();
      });

      engine.execute({
        listener: listener,
        variables: {
          input: null
        }
      });
      engine.once('end', done.bind(null, null));
    });

    lab.test('resumes execution and returns definition in callback', (done) => {
      const resumeListener = new EventEmitter();
      const resumedEngine = Bpmn.Engine.resume(testHelpers.readFromDb(engineState), {
        listener: resumeListener
      }, (resumeErr, instance) => {
        if (resumeErr) return done(resumeErr);
        instance.signal('userTask');
      });

      resumedEngine.once('end', done.bind(null, null));
    });

    lab.test('resumes without callback', (done) => {
      const resumeListener = new EventEmitter();
      resumeListener.once('wait', (task) => {
        task.signal();
      });

      const resumedEngine = Bpmn.Engine.resume(testHelpers.readFromDb(engineState), {
        listener: resumeListener
      });

      resumedEngine.once('end', done.bind(null, null));
    });

    lab.test('resume failure emits error if no callback', (done) => {
      testHelpers.getModdleContext(factory.invalid(), {}, (merr, moddleContext) => {
        const engine = Bpmn.Engine.resume({
          name: 'Invalid state',
          definitions: [{
            id: 'who',
            moddleContext: moddleContext
          }],
        });
        engine.once('error', () => {
          done();
        });
      });
    });

    lab.test('resume failure returns error in callback', (done) => {
      testHelpers.getModdleContext(factory.invalid(), {}, (merr, moddleContext) => {
        Bpmn.Engine.resume({
          name: 'Invalid state',
          definitions: [{
            id: 'who',
            moddleContext: moddleContext
          }],
        }, (err) => {
          expect(err).to.be.an.error();
          done();
        });
      });
    });

    lab.test('with invalid engine state throws', (done) => {
      function fn() {
        Bpmn.Engine.resume({
          definitions: 'invalid array'
        });
      }
      expect(fn).to.throw(/must be an array/);
      done();
    });
  });

  lab.describe('multiple definitions', () => {
    const engine = new Bpmn.Engine();
    const listener = new EventEmitter();
    const processes = [];

    lab.test('given we have a first definition', (done) => {
      engine.addDefinitionBySource(factory.userTask('userTask1', 'def1'), done);
    });

    lab.test('and a second definition', (done) => {
      engine.addDefinitionBySource(factory.userTask('userTask2', 'def2'), done);
    });

    lab.test('when we execute', (done) => {
      let startCount = 0;
      listener.on('start-theProcess', function EH(process) {
        startCount++;
        processes.push(process);
        if (startCount === 2) {
          listener.removeListener('start-theProcess', EH);
          return done();
        }
      });

      engine.execute({
        listener: listener
      });
    });

    lab.test('all processes are started', (done) => {
      expect(processes.length).to.equal(2);
      expect(processes[0]).to.contain({entered: true});
      expect(processes[1]).to.contain({entered: true});
      done();
    });

    lab.test('when first process completes engine doesn´t emit end event', (done) => {
      const endListener = () => {
        Code.fail('Should not have ended');
      };
      engine.once('end', endListener);

      const definition = engine.getDefinitionById('def1');
      const task = definition.getChildActivityById('userTask1');
      task.signal();

      definition.once('end', () => {
        engine.removeListener('end', endListener);
        done();
      });
    });

    lab.test('when second process is completed engine emits end event', (done) => {
      engine.once('end', () => {
        done();
      });

      const task = engine.getDefinitionById('def2').getChildActivityById('userTask2');
      task.signal();
    });
  });

  lab.describe('addDefinitionBySource()', () => {
    lab.test('adds definition', (done) => {
      const engine = new Bpmn.Engine();
      engine.addDefinitionBySource(factory.valid(), (err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    lab.test('adds definition once, identified by id', (done) => {
      const engine = new Bpmn.Engine();
      const source = factory.valid('def1');

      engine.addDefinitionBySource(source, (err1) => {
        if (err1) return done(err1);
        expect(engine.definitions.length).to.equal(1);

        engine.addDefinitionBySource(source, (err2) => {
          if (err2) return done(err2);
          expect(engine.definitions.length).to.equal(1);
          done();
        });
      });
    });

    lab.test('adds definition with moddleOptions', (done) => {
      const engine = new Bpmn.Engine();
      engine.addDefinitionBySource(factory.valid(), {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    lab.test('returns error in callback if transform error', (done) => {
      const engine = new Bpmn.Engine();
      engine.addDefinitionBySource('not xml', (err) => {
        expect(err).to.exist();
        expect(engine.definitions.length).to.equal(0);
        done();
      });
    });
  });

  lab.describe('signal()', () => {
    lab.test('without definitions is ignored', (done) => {
      const engine = new Bpmn.Engine();
      engine.signal();
      done();
    });

    lab.test('without waiting task is ignored', (done) => {
      const definitionSource = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="singleUserTask" isExecutable="true">
    <task id="task" />
  </process>
</definitions>
      `;
      const engine = new Bpmn.Engine({
        source: definitionSource
      });
      engine.execute(() => {
        engine.signal('task');
        done();
      });
    });

    lab.test('with non-existing activity id is ignored', (done) => {
      const definitionSource = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="singleUserTask" isExecutable="true">
    <userTask id="userTask" />
  </process>
</definitions>
      `;
      const engine = new Bpmn.Engine({
        source: definitionSource
      });
      engine.execute(() => {
        engine.signal('task');
        done();
      });
    });
  });

  lab.describe('getPendingActivities()', () => {
    const definitionSource = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theWaitingGame" isExecutable="true">
    <startEvent id="start" />
    <parallelGateway id="fork" />
    <userTask id="userTask1" />
    <userTask id="userTask2">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="surname" label="Surname" type="string" />
          <camunda:formField id="givenName" label="Given name" type="string" />
        </camunda:formData>
      </extensionElements>
    </userTask>
    <task id="task" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="userTask1" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="userTask2" />
    <sequenceFlow id="flow4" sourceRef="fork" targetRef="task" />
    <sequenceFlow id="flow5" sourceRef="userTask1" targetRef="join" />
    <sequenceFlow id="flow6" sourceRef="userTask2" targetRef="join" />
    <sequenceFlow id="flow7" sourceRef="task" targetRef="join" />
    <sequenceFlow id="flowEnd" sourceRef="join" targetRef="end" />
  </process>
</definitions>
    `;

    let engine, pending;
    lab.test('given an engine', (done) => {
      engine = new Bpmn.Engine({
        source: definitionSource,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      done();
    });

    lab.test('returns empty definitions if not loaded', (done) => {
      expect(engine.getPendingActivities().definitions).to.have.length(0);
      done();
    });

    lab.test('when executed', (done) => {

      const listener = new EventEmitter();
      listener.once('enter-join', () => {
        pending = engine.getPendingActivities();
        done();
      });

      engine.execute({
        listener: listener
      });
    });

    lab.test('then all entered activities are returned', (done) => {
      expect(pending.definitions).to.have.length(1);
      expect(pending.definitions[0]).to.include(['children']);
      expect(pending.definitions[0].children).to.have.length(3);
      expect(pending.definitions[0].children).to.have.length(3);
      done();
    });

    lab.test('comples when all user tasks are signaled', (done) => {
      engine.once('end', done.bind(null, null));

      pending.definitions[0].children.filter(c => c.type === 'bpmn:UserTask').forEach((c) => {
        engine.signal(c.id);
      });
    });

  });
});
