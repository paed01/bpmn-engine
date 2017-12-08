'use strict';

const Bpmn = require('..');
const BpmnModdle = require('bpmn-moddle');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const testHelpers = require('./helpers/testHelpers');

describe('Engine', () => {
  it('Bpmn exposes Engine', () => {
    expect(Bpmn).to.have.property('Engine');
  });
  it('Bpmn exposes Defintion', () => {
    expect(Bpmn).to.have.property('Definition');
  });
  it('Bpmn exposes transformer', () => {
    expect(Bpmn).to.have.property('transformer');
  });
  it('Bpmn exposes validation', () => {
    expect(Bpmn).to.have.property('validation');
  });

  describe('ctor', () => {
    it('without arguments is ok', () => {
      expect(() => {
        new Bpmn.Engine();
      }).to.not.throw(Error);
    });

    it('takes source option', () => {
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      expect(engine.sources).to.be.ok;
      expect(engine.sources.length).to.equal(1);
    });

    it('throws if unsupported source is passed', () => {
      expect(() => {
        new Bpmn.Engine({
          source: {}
        });
      }).to.throw(/Unparsable Bpmn source/i);
    });

    it('throws if unsupported option is passed', () => {
      expect(() => {
        new Bpmn.Engine({
          context: {}
        });
      }).to.throw(/Option \w+ is unsupported/i);
    });

    it('accepts source as Buffer', (done) => {
      const source = new Buffer(factory.valid());
      const engine = new Bpmn.Engine({
        name: 'source from buffer',
        source
      });
      engine.execute((err) => {
        expect(err).to.not.be.ok;
        done();
      });
    });

    it('but not function', () => {
      const source = () => {};
      expect(() => {
        new Bpmn.Engine({
          source
        });
      }).to.throw();
    });

    it('accepts name', () => {
      let engine;
      expect(() => {
        engine = new Bpmn.Engine({
          name: 'no source'
        });
      }).to.not.throw();

      expect(engine.name).to.equal('no source');
    });
  });

  describe('getDefinition()', () => {
    it('returns definition of passed moddle context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.valid('contextTest'), (moddleErr, definition, moddleContext) => {
        if (moddleErr) return done(moddleErr);

        const engine = new Bpmn.Engine({
          moddleContext
        });
        engine.getDefinition((err) => {
          if (err) return done(err);
          expect(engine.getDefinitionById('contextTest')).to.be.ok;
          done();
        });
      });
    });

    it('returns definition of passed deserialized moddle context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.valid('contextTest'), (moddleErr, definition, context) => {
        if (moddleErr) return done(moddleErr);
        const engine = new Bpmn.Engine({
          moddleContext: JSON.parse(testHelpers.serializeModdleContext(context))
        });
        engine.getDefinition((err) => {
          if (err) return done(err);
          expect(engine.getDefinitionById('contextTest')).to.be.ok;
          done();
        });
      });
    });

    it('returns error in callback if invalid definition', (done) => {
      const engine = new Bpmn.Engine({
        source: 'not xml'
      });
      engine.getDefinition((err) => {
        expect(err).to.be.ok;
        done();
      });
    });

    it('returns undefined in callback if no definitions', (done) => {
      const engine = new Bpmn.Engine();
      engine.getDefinition((err, def) => {
        expect(err).to.not.be.ok;
        expect(def).to.not.be.ok;
        done();
      });
    });
  });

  describe('execute()', () => {
    it('without arguments runs process', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      engine.once('end', () => {
        done();
      });

      engine.execute();
    });

    it('returns error in callback if no source', (done) => {
      const engine = new Bpmn.Engine({
        source: ''
      });
      engine.execute((err) => {
        expect(err).to.be.an('error').and.match(/nothing to execute/i);
        done();
      });
    });

    it('returns error in callback if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.execute((err) => {
        expect(err).to.be.ok;
        done();
      });
    });

    it('emits error if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine({
        source: 'jdalsk'
      });
      engine.once('error', (err) => {
        expect(err).to.be.an('error');
        done();
      });

      engine.execute();
    });

    it('returns error in callback if no executable process', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="false" />
      </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err) => {
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

      const engine = new Bpmn.Engine({
        source
      });

      engine.once('error', (err) => {
        expect(err).to.be.an('error').and.match(/ executable process/);
        done();
      });

      engine.execute();
    });

    it('emits end when all processes have completed', (done) => {
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

    it('emits error if execution fails', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" implementation="\${services.get}" />
        </process>
      </definitions>`;

      const engine = new Bpmn.Engine({
        name: 'end test',
        source,
      });
      engine.once('error', (err) => {
        expect(err).to.be.an('error').and.match(/Inner error/i);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.execute({
        services: {
          get: (context, next) => {
            next(new Error('Inner error'));
          }
        }
      });
    });

    it('runs process with deserialized context', (done) => {
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

    describe('execute options', () => {
      it('throws error if listener doesn´t have an emit function', (done) => {
        const engine = new Bpmn.Engine({
          source: factory.resource('lanes.bpmn')
        });

        function testFn() {
          engine.execute({
            listener: {}
          });
        }

        expect(testFn).to.throw(Error, /"emit" function is required/);
        done();
      });

      it('returns error in callback if service type is not "global" or "require"', (done) => {
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

    it('exposes services to participant processes', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.resource('mother-of-all.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait', (activityApi) => {
        if (activityApi.type === 'bpmn:UserTask') {
          activityApi.signal({
            input: 1
          });
        }
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
      });

      engine.once('end', () => {
        done();
      });
    });
  });

  describe('getState()', () => {
    const source = factory.userTask();

    it('returns state "running" when running definitions', (done) => {
      const engine = new Bpmn.Engine({
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
        listener: listener,
        variables: {
          input: null
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns state "idle" when nothing is running', (done) => {
      const engine = new Bpmn.Engine({
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
      const engine = new Bpmn.Engine({
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
        listener: listener,
        variables: {
          input: null
        }
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('returns engine package version', (done) => {
      const engine = new Bpmn.Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
        expect(state.engineVersion).to.match(/^\d+\.\d+\.\d+/);
        done();
      });

      engine.execute({
        listener: listener,
        variables: {
          input: null
        }
      });
    });
  });

  describe('Engine.resume()', () => {
    let engineState;
    before((done) => {
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
    const engine = new Bpmn.Engine();
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
      const engine = new Bpmn.Engine();
      engine.addDefinitionBySource(factory.valid());

      engine.getDefinitions((err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    it('adds definition once, identified by id', (done) => {
      const engine = new Bpmn.Engine();
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
      const engine = new Bpmn.Engine();
      engine.addDefinitionBySource(factory.valid());

      engine.getDefinitions((err) => {
        if (err) return done(err);
        expect(engine.definitions.length).to.equal(1);
        done();
      });
    });

    it('returns error in callback if transform error', (done) => {
      const engine = new Bpmn.Engine();
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
      const engine = new Bpmn.Engine();
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
      const engine = new Bpmn.Engine({
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
      const engine = new Bpmn.Engine({
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
      engine = new Bpmn.Engine({
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
