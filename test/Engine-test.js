'use strict';

const Bpmn = require('..');
const BpmnModdle = require('../dist/bpmn-moddle');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const testHelpers = require('./helpers/testHelpers');

describe('Engine', () => {
  it('Bpmn exposes Engine', () => {
    expect(Bpmn).to.have.property('Engine');
  });
  it.skip('Bpmn exposes Defintion', () => {
    expect(Bpmn).to.have.property('Definition');
  });
  it.skip('Bpmn exposes transformer', () => {
    expect(Bpmn).to.have.property('transformer');
  });
  it.skip('Bpmn exposes validation', () => {
    expect(Bpmn).to.have.property('validation');
  });

  describe('ctor', () => {
    it('without arguments is ok', () => {
      expect(() => {
        Bpmn.Engine();
      }).to.not.throw(Error);
    });

    it('takes source option', async () => {
      const engine = Bpmn.Engine({
        source: factory.valid()
      });

      const definitions = await engine.getDefinitions();

      expect(definitions).to.be.ok;
      expect(definitions.length).to.equal(1);
    });

    it('throws if unsupported source is passed', (done) => {
      const engine = Bpmn.Engine({
        source: {}
      });

      engine.getDefinitions().catch((err) => {
        expect(err).to.be.ok;
        done();
      });
    });

    it('accepts source as Buffer', async () => {
      const source = Buffer.from(factory.valid());
      const engine = Bpmn.Engine({
        name: 'source from buffer',
        source
      });

      const definitions = await engine.getDefinitions();
      expect(definitions).to.have.length(1);
    });

    it('but not function', (done) => {
      const engine = Bpmn.Engine({
        source() {}
      });

      engine.getDefinitions().catch((err) => {
        expect(err).to.be.ok;
        done();
      });
    });

    it('accepts name', () => {
      const engine = Bpmn.Engine({
        name: 'no source'
      });

      expect(engine.name).to.equal('no source');
    });
  });

  describe('getDefinitions()', () => {
    it('returns definitions', async () => {
      const engine = Bpmn.Engine({
        source: factory.valid(),
        listener: new EventEmitter()
      });

      const definitions = await engine.getDefinitions();
      expect(definitions).to.have.length(1);
      expect(definitions[0]).to.property('type', 'bpmn:Definitions');
      expect(definitions[0]).to.property('run').that.is.a('function');
    });

    it('definition has listener as option', async () => {
      const engine = Bpmn.Engine({
        source: factory.valid(),
        listener: new EventEmitter()
      });

      const definitions = await engine.getDefinitions();
      expect(definitions).to.have.length(1);
      expect(definitions[0]).to.have.property('environment').with.property('options').with.property('listener');
      expect(definitions[0].environment.options).to.have.property('source');
    });

    it('rejects if invalid definition source', (done) => {
      const engine = Bpmn.Engine({
        source: 'not xml'
      });
      engine.getDefinitions().catch((err) => {
        expect(err).to.be.ok;
        done();
      });
    });

    it('returns none no definition sources', async () => {
      const engine = Bpmn.Engine();
      expect(await engine.getDefinitions()).to.have.length(0);
    });
  });

  describe('getDefinitionById()', () => {
    it('returns definition of passed moddle context', async () => {
      const moddleContext = await testHelpers.moddleContext(factory.valid('contextTest'));

      const engine = Bpmn.Engine({
        moddleContext
      });

      const definition = await engine.getDefinitionById('contextTest');
      expect(definition).to.be.ok;
      expect(definition).to.property('type', 'bpmn:Definitions');
      expect(definition).to.property('run').that.is.a('function');
    });

    it('returns definition of passed deserialized moddle context', async () => {
      const moddleContext = await testHelpers.moddleContext(factory.valid('contextTest'));

      const engine = Bpmn.Engine({
        moddleContext: JSON.parse(testHelpers.serializeModdleContext(moddleContext))
      });

      expect(await engine.getDefinitionById('contextTest')).to.be.ok;
    });
  });

  describe('execute()', () => {
    it('without arguments runs definition', (done) => {
      const engine = Bpmn.Engine({
        source: factory.valid()
      });

      engine.once('end', () => {
        done();
      });

      engine.execute();
    });

    it('with options runs definitions with options', (done) => {
      const engine = Bpmn.Engine({
        source: factory.valid(),
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        variables: {
          input: 1
        }
      });
    });

    it.skip('returns error in callback if no source', (done) => {
      const engine = Bpmn.Engine({
        source: ''
      });
      engine.execute((err) => {
        expect(err).to.be.an('error').and.match(/nothing to execute/i);
        done();
      });
    });

    it('rejects if not well formatted xml', (done) => {
      const engine = Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.execute().catch((err) => {
        expect(err).to.be.ok;
        done();
      });
    });

    it.skip('emits error if not well formatted xml', (done) => {
      const engine = Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.once('error', (err) => {
        expect(err).to.be.an('error');
        done();
      });

      engine.execute();
    });

    it('rejects if no executable process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="false" />
      </definitions>`;

      const engine = Bpmn.Engine({
        source
      });
      engine.execute().catch((err) => {
        expect(err).to.be.an('error').and.match(/ executable process/);
        done();
      });
    });

    it('emits error if called with invalid definition and no callback', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="false" />
      </definitions>`;

      const engine = Bpmn.Engine({
        source
      });

      engine.once('error', (err) => {
        expect(err).to.be.an('error').and.match(/ executable process/);
        done();
      });

      engine.execute();
    });

    it('emits end when all processes have completed', (done) => {
      const engine = Bpmn.Engine({
        name: 'end test',
        source: factory.resource('lanes.bpmn')
      });
      engine.once('end', () => {
        done();
      });

      engine.execute();
    });

    it('emits error if execution fails', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" implementation="\${environment.services.get}" />
        </process>
      </definitions>`;

      const engine = Bpmn.Engine({
        name: 'end test',
        source,
        services: {
          get: (context, next) => {
            next(new Error('Inner error'));
          }
        }
      });
      engine.once('error', (err) => {
        expect(err).to.be.an('error').and.match(/Inner error/i);
        done();
      });

      engine.execute();
    });

    it.skip('runs process with deserialized context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.resource('lanes.bpmn').toString(), (moddleErr, definition, context) => {
        if (moddleErr) return done(moddleErr);

        const engine = Bpmn.Engine({
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

    it('throws error if listener doesn´t have an emit function', async () => {
      const engine = Bpmn.Engine({
        source: factory.resource('lanes.bpmn')
      });

      try {
        await engine.execute({
          listener: {}
        });
      } catch (e) {
        var err = e; // eslint-disable-line
      }

      expect(err).to.match(/emit is not a function/);
    });

    it('exposes services to participant processes', (done) => {
      const engine = Bpmn.Engine({
        source: factory.resource('mother-of-all.bpmn'),
        services: {
          serviceFn(...args) {
            args.pop()();
          }
        },
        variables: {
          input: 0
        },
      });

      const listener = new EventEmitter();
      listener.on('wait', (activityApi) => {
        if (activityApi.type === 'bpmn:UserTask') {
          activityApi.signal({
            input: 1
          });
        }
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        listener,
      }).catch(done);
    });

    it('writes to environment output on end', async () => {
      const engine = Bpmn.Engine({
        source: factory.userTask(),
        variables: {
          _data: {
            input: 'von Rosén',
          }
        },
      });

      const listener = new EventEmitter();
      listener.on('wait', (activityApi) => {
        expect(activityApi).to.have.property('content').with.property('ioSpecification').with.property('dataInputs').with.length(1);
        expect(activityApi.content.ioSpecification.dataInputs[0]).to.have.property('value', 'von Rosén');
        expect(activityApi.content.ioSpecification).to.have.property('dataOutputs').with.length(1);
        expect(activityApi.content.ioSpecification.dataOutputs[0]).to.have.property('id', 'userInput');

        activityApi.signal({
          ioSpecification: {
            dataOutputs: [{
              id: 'userInput',
              value: 'von Rosen'
            }]
          }
        });
      });

      await engine.execute({
        listener,
      });

      expect(engine.environment.output).to.have.property('_data').with.property('input', 'von Rosen');
      expect(engine.environment.output).to.have.property('_data');
    });
  });

  describe('getState()', () => {
    const source = factory.userTask();

    it('returns state "running" when running definitions', (done) => {
      const engine = Bpmn.Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
        expect(state).to.be.an('object');
        expect(state).to.include({
          state: 'running'
        });
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns state "idle" when nothing is running', (done) => {
      const engine = Bpmn.Engine({
        source
      });

      const state = engine.getState();

      expect(state).to.be.an('object');
      expect(state).to.include({
        state: 'idle'
      });
      done();
    });

    it('returns state of running definitions', (done) => {
      const engine = Bpmn.Engine({
        name: 'running',
        source
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
        expect(state.name).to.equal('running');
        expect(state.definitions).to.have.length(1);
        expect(state.definitions[0]).to.be.an('object');
        expect(state.definitions[0].processes).to.be.an('object');
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns engine package version', (done) => {
      const engine = Bpmn.Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
        expect(state.engineVersion).to.match(/^\d+\.\d+\.\d+/);
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      });
    });
  });

  describe('resume()', () => {
    let engineState;
    before((done) => {
      const engine = Bpmn.Engine({
        name: 'test resume',
        source: factory.userTask()
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        engineState = engine.getState();
        engine.stop();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      });
      engine.once('end', done.bind(null, null));
    });

    it('resumes execution and returns definition in callback', (done) => {
      const resumeListener = new EventEmitter();
      resumeListener.once('wait-userTask', (activityApi) => {
        activityApi.signal();
      });

      const resumedEngine = Bpmn.Engine.resume(testHelpers.readFromDb(engineState), {
        listener: resumeListener
      }, (resumeErr) => {
        if (resumeErr) return done(resumeErr);
      });

      resumedEngine.once('end', done.bind(null, null));
    });

    it('resumes without callback', (done) => {
      const resumeListener = new EventEmitter();
      resumeListener.once('wait', (activityApi) => {
        activityApi.signal();
      });

      const resumedEngine = Bpmn.Engine.resume(testHelpers.readFromDb(engineState), {
        listener: resumeListener
      });

      resumedEngine.once('end', done.bind(null, null));
    });

    it('resume failure emits error if no callback', (done) => {
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

    it('resume failure returns error in callback', (done) => {
      testHelpers.getModdleContext(factory.invalid(), {}, (merr, moddleContext) => {
        Bpmn.Engine.resume({
          name: 'Invalid state',
          definitions: [{
            id: 'who',
            moddleContext: moddleContext
          }],
        }, (err) => {
          expect(err).to.be.an('error');
          done();
        });
      });
    });

    it('with invalid engine state throws', (done) => {
      function fn() {
        Bpmn.Engine.resume({
          definitions: 'invalid array'
        });
      }
      expect(fn).to.throw(/must be an array/);
      done();
    });
  });

  describe('multiple definitions', () => {
    const engine = Bpmn.Engine();
    const listener = new EventEmitter();
    const processes = [];

    it('given we have a first definition', (done) => {
      engine.addDefinitionBySource(factory.userTask('userTask1', 'def1'));
      done();
    });

    it('and a second definition', (done) => {
      engine.addDefinitionBySource(factory.userTask('userTask2', 'def2'));
      done();
    });

    it('when we execute', (done) => {
      let startCount = 0;
      listener.on('start-theProcess', function EH(processApi) {
        startCount++;

        processes.push(processApi);
        if (startCount === 2) {
          listener.removeListener('start-theProcess', EH);
          return done();
        }
      });

      engine.execute({
        listener
      });
    });

    it('all processes are started', (done) => {
      expect(processes.length).to.equal(2);
      expect(processes[0].getState()).to.contain({entered: true});
      expect(processes[1].getState()).to.contain({entered: true});
      done();
    });

    it('when first process completes engine doesn´t emit end event', (done) => {
      const endListener = () => {
        expect.fail('Should not have ended');
      };
      engine.once('end', endListener);

      const definition = engine.getDefinitionById('def1');

      definition.once('end', () => {
        engine.removeListener('end', endListener);
        done();
      });

      definition.signal('userTask1');
    });

    it('when second process is completed engine emits end event', (done) => {
      engine.once('end', () => {
        done();
      });

      const definition = engine.getDefinitionById('def2');
      definition.signal('userTask2');
    });
  });

  describe('addDefinitionBySource()', () => {
    it('adds definition', (done) => {
      const engine = Bpmn.Engine();
      engine.addDefinitionBySource(factory.valid());

      engine.getDefinitions((err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    it('adds definition once, identified by id', (done) => {
      const engine = Bpmn.Engine();
      const source = factory.valid('def1');
      engine.addDefinitionBySource(source);
      engine.addDefinitionBySource(source);

      engine.getDefinitions((err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    it('adds definition with moddleOptions', (done) => {
      const engine = Bpmn.Engine();
      engine.addDefinitionBySource(factory.valid());

      engine.getDefinitions((err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    it('returns error in callback if transform error', (done) => {
      const engine = Bpmn.Engine();
      engine.addDefinitionBySource('not xml');
      engine.getDefinitions((err) => {
        expect(err).to.be.an('error');
        expect(engine.definitions.length).to.equal(0);
        done();
      });
    });
  });

  describe('signal()', () => {
    it('without definitions is ignored', (done) => {
      const engine = Bpmn.Engine();
      engine.signal();
      done();
    });

    it('without waiting task is ignored', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="singleUserTask" isExecutable="true">
          <task id="task" />
        </process>
      </definitions>
      `;
      const engine = Bpmn.Engine({
        source
      });
      engine.execute(() => {
        engine.signal('task');
        done();
      });
    });

    it('with non-existing activity id is ignored', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="singleUserTask" isExecutable="true">
          <userTask id="userTask" />
        </process>
      </definitions>`;
      const engine = Bpmn.Engine({
        source
      });
      const listener = new EventEmitter();
      listener.once('wait', () => {
        engine.signal('task');
        done();
      });

      engine.execute({listener});
    });
  });

  describe('getPendingActivities()', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theWaitingGame" isExecutable="true">
        <startEvent id="start" />
        <parallelGateway id="fork" />
        <userTask id="userTask1" />
        <userTask id="userTask2" />
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
    </definitions>`;

    let engine, pending;
    it('given an engine', (done) => {
      engine = Bpmn.Engine({
        name: 'get pending',
        source
      });
      done();
    });

    it('returns empty definitions if not loaded', (done) => {
      expect(engine.getPendingActivities().definitions).to.have.length(0);
      done();
    });

    it('when executed', (done) => {
      const listener = new EventEmitter();
      listener.once('start-join', () => {
        pending = engine.getPendingActivities();
        done();
      });

      engine.execute({
        listener
      });
    });

    it('then all entered activities are returned', (done) => {
      expect(pending.definitions).to.have.length(1);
      expect(pending.definitions[0]).to.have.property('children').with.length(5);
      done();
    });

    it('comples when all user tasks are signaled', (done) => {
      engine.once('end', done.bind(null, null));

      pending.definitions[0].children.filter(c => c.type === 'bpmn:UserTask').forEach((c) => {
        engine.signal(c.id);
      });
    });
  });
});
