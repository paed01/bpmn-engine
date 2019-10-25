const Bpmn = require('..');
const factory = require('./helpers/factory');
const testHelpers = require('./helpers/testHelpers');
const { EventEmitter } = require('events');

describe('Engine', () => {
  describe('options', () => {
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
        source() { }
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

    it('name can be set', () => {
      const engine = Bpmn.Engine();
      engine.name = 'still no source';
      expect(engine.name).to.equal('still no source');
    });

    it('exposes execution when running', async () => {
      const source = Buffer.from(factory.valid());
      const engine = Bpmn.Engine({
        name: 'execution prop',
        source
      });

      await engine.execute();
      expect(engine.execution).to.be.ok;
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
        moddleContext: JSON.parse(JSON.stringify(testHelpers.serializeModdleContext(moddleContext)))
      });

      expect(await engine.getDefinitionById('contextTest')).to.be.ok;
    });
  });

  describe('execute([options, callback])', () => {
    it('runs definition and emits end when completed', (done) => {
      const engine = Bpmn.Engine({
        source: factory.valid()
      });

      engine.once('end', () => {
        done();
      });

      engine.execute();
    });

    it('returns api with name, running definitions, and function to get postponed activities', async () => {
      const engine = Bpmn.Engine({
        name: 'with api',
        source: factory.userTask('userTask')
      });

      const api = await engine.execute();
      expect(api).to.have.property('name', 'with api');
      expect(api).to.have.property('definitions').to.have.length(1);
      expect(api.definitions[0]).to.have.property('status', 'executing');
      expect(api).to.have.property('getPostponed').that.is.a('function');

      const postponed = api.getPostponed();
      expect(postponed).to.have.length(1);
      expect(postponed[0]).to.have.property('id', 'userTask');
    });

    it('engine and execution api definitions are the same', async () => {
      const engine = Bpmn.Engine({
        name: 'with api',
        source: factory.userTask('userTask')
      });

      const engineDefs = await engine.getDefinitions();
      const api = await engine.execute();

      expect(engineDefs.length).to.be.above(0);
      expect(engineDefs.length, 'same length').to.equal(api.definitions.length);
      expect(engineDefs[0] === api.definitions[0], 'same instance');
    });

    it('with options runs definitions with options', (done) => {
      const engine = Bpmn.Engine({
        source: factory.valid(),
      });

      engine.once('end', (execution) => {
        expect(execution.definitions[0].environment.variables).to.have.property('input', 1);
        expect(execution.environment.variables).to.not.have.property('input');
        done();
      });

      engine.execute({
        variables: {
          input: 1
        }
      });
    });

    it('execute options overrides engine options', (done) => {
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
        variables: {
          input: 0
        },
        services: {
          get(context, next) {
            next(new Error('Inner error'));
          }
        }
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        variables: {
          input: 1
        },
        services: {
          get(context, next) {
            if (context.environment.variables.input !== 1) return next(new Error('Get error'));
            next(null, context.environment.variables.input);
          }
        }
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

    it('returns error in callback if not well formatted xml', (done) => {
      const engine = Bpmn.Engine({
        source: 'jdalsk'
      });

      engine.execute((err) => {
        expect(err).to.be.an('error');
        done();
      });
    });

    it('returns error in callback if no executable process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="false" />
      </definitions>`;

      const engine = Bpmn.Engine({
        source
      });
      engine.execute((err) => {
        expect(err).to.be.an('error').and.match(/executable process/);
        done();
      });
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
        expect(err).to.be.an('error').and.match(/executable process/);
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

    it('returns error in callback if execution fails', (done) => {
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

      engine.execute((err) => {
        expect(err).to.be.an('error').and.match(/Inner error/i);
        done();
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
          data: {
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

      expect(engine.environment.output).to.have.property('data').with.property('inputFromUser', 'von Rosen');
    });
  });

  describe('waitFor(eventName)', () => {
    it('end resolves when execution completes', async () => {
      const engine = Bpmn.Engine({
        source: factory.valid()
      });

      const end = engine.waitFor('end');

      engine.execute();

      await end;

      expect(engine).to.have.property('state', 'idle');
    });

    it('end rejects if error occur', async () => {
      const engine = Bpmn.Engine({
        source: factory.invalid()
      });

      let error;
      const end = engine.waitFor('end').catch((err) => {
        error = err;
      });

      engine.execute();

      await end;

      expect(error).to.be.ok;
    });
  });

  describe('getState()', () => {
    const source = factory.userTask();

    it('engine returns non-running state', async () => {
      const sourceEngine = Bpmn.Engine({
        name: 'test state',
        source: factory.userTask()
      });
      expect(await sourceEngine.getDefinitions()).to.have.length(1);

      const state = await sourceEngine.getState();
      expect(state).to.have.property('name', 'test state');
      expect(state).to.have.property('definitions').with.length(1);
      expect(state.definitions[0]).to.have.property('source');
    });

    it('returns state "running" when running definitions', (done) => {
      const engine = Bpmn.Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('wait', (_, engineApi) => {
        const state = engineApi.getState();
        expect(state).to.be.an('object');
        expect(state).to.have.property('state', 'running');
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      });
    });

    it('returns state "idle" when nothing is running', async () => {
      const engine = Bpmn.Engine({
        source
      });

      const state = await engine.getState();

      expect(state).to.be.an('object');
      expect(state).to.have.property('state', 'idle');
    });

    it('returns state of running definitions', (done) => {
      const engine = Bpmn.Engine({
        name: 'running',
        source
      });
      const listener = new EventEmitter();

      listener.on('wait', (_, engineApi) => {
        const state = engineApi.getState();
        expect(state.state).to.equal('running');
        expect(state.definitions).to.have.length(1);
        expect(state.definitions[0]).to.be.an('object');
        expect(state.definitions[0].execution).to.be.ok;
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      });
    });

    it('returns state of running definitions', (done) => {
      const engine = Bpmn.Engine({
        name: 'running',
        source
      });
      const listener = new EventEmitter();

      listener.on('wait', (_, engineApi) => {
        const state = engineApi.getState();
        expect(state.state).to.equal('running');
        expect(state.definitions).to.have.length(1);
        expect(state.definitions[0]).to.be.an('object');
        expect(state.definitions[0].execution).to.be.ok;
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      });
    });

    it('returns engine package version', (done) => {
      const engine = Bpmn.Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('wait', (_, engineApi) => {
        const state = engineApi.getState();
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

  describe('stop()', () => {
    it('stop by engine stops execution', async () => {
      const engine = Bpmn.Engine({
        name: 'stop test',
        source: factory.userTask(),
      });

      expect(engine).to.have.property('stopped', false);

      const api = await engine.execute();

      await engine.stop();

      expect(engine).to.have.property('state', 'stopped');
      expect(engine).to.have.property('stopped', true);
      expect(api).to.have.property('stopped', true);
      expect(api.definitions[0]).to.have.property('stopped', true);
    });

    it('stop by api stops execution', async () => {
      const engine = Bpmn.Engine({
        name: 'stop test',
        source: factory.userTask(),
      });

      const api = await engine.execute();
      await api.stop();

      expect(api).to.have.property('stopped', true);
      expect(engine).to.have.property('state', 'stopped');
      expect(engine).to.have.property('stopped', true);
      expect(api.definitions[0]).to.have.property('stopped', true);
    });
  });

  describe('recover(state[, recoverOptions])', () => {
    it('recovers engine from state', async () => {
      const sourceEngine = Bpmn.Engine({
        name: 'test recover',
        source: factory.userTask()
      });
      expect(await sourceEngine.getDefinitions()).to.have.length(1);
      expect(sourceEngine).to.have.property('state', 'idle');

      const engine = Bpmn.Engine().recover(await sourceEngine.getState());
      expect(engine).to.have.property('name', 'test recover');
      expect(engine).to.have.property('state', 'idle');
      expect(await engine.getDefinitions()).to.have.length(1);
    });

    it('recover without state is simply ignored', async () => {
      const engine = Bpmn.Engine().recover();
      const recovered = engine.recover();

      expect(engine === recovered).to.be.true;
    });

    it('recovers definition running state', async () => {
      const sourceEngine = Bpmn.Engine({
        name: 'test recover',
        source: factory.userTask()
      });

      const sourceApi = await sourceEngine.execute();

      expect(sourceApi.definitions).to.have.length(1);
      expect(sourceApi.definitions[0]).to.have.property('status', 'executing');

      const engine = Bpmn.Engine().recover(await sourceEngine.getState());
      const definitions = await engine.getDefinitions();
      expect(definitions).to.have.length(1);
      expect(definitions[0]).to.have.property('status', 'executing');
    });

    it('doesn´t overwrite name from state if instantiated with name', async () => {
      const sourceEngine = Bpmn.Engine({
        name: 'test recover',
        source: factory.userTask()
      });

      const engine = Bpmn.Engine({ name: 'my new name' }).recover(await sourceEngine.getState());
      expect(engine).to.have.property('name', 'my new name');
    });

    it('environment is recovered', async () => {
      const engine = Bpmn.Engine({
        name: 'test recover',
        source: factory.userTask(),
        variables: {
          execVersion: 1,
        }
      });

      engine.execute();

      await engine.stop();

      const recovered = Bpmn.Engine().recover(await engine.getState());

      expect(recovered.environment.variables).to.have.property('execVersion', 1);
    });

    it('recover options initializes new environment and passes options to recovered definitions', async () => {
      const engine = Bpmn.Engine({
        name: 'test recover',
        source: factory.userTask(),
        variables: {
          execVersion: 1,
        }
      });

      engine.execute();

      await engine.stop();

      const recovered = Bpmn.Engine().recover(await engine.getState(), {
        variables: {
          execVersion: 2,
          recovered: true,
        },
        services: {
          get() { },
        }
      });

      expect(recovered.environment.variables).to.have.property('execVersion', 1);
      expect(recovered.environment.variables).to.have.property('recovered', true);
      const [definition] = await recovered.getDefinitions();
      expect(definition.environment.variables).to.have.property('execVersion', 1);
      expect(definition.environment.variables).to.have.property('recovered', true);

      expect(definition.environment.services).to.have.property('get').that.is.a('function');
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

      listener.on('wait', () => {
        engine.stop();
      });

      engine.on('stop', async () => {
        engineState = await engine.getState();
        done();
      });

      engine.execute({
        listener,
        variables: {
          input: null
        }
      });
    });

    it('resumes recovered execution', (done) => {
      const listener = new EventEmitter();
      listener.once('wait', (activityApi) => {
        activityApi.signal();
      });

      const engine = Bpmn.Engine();
      engine.recover(JSON.parse(JSON.stringify(engineState)));
      engine.once('end', done.bind(null, null));

      engine.resume({ listener });
    });

    it('resume with new listener replaces listener', async () => {
      const listener = new EventEmitter();
      const engine = Bpmn.Engine();
      engine.recover(engineState);
      engine.resume({ listener });

      const definitions = await engine.getDefinitions();
      expect(definitions).to.have.length(1);

      expect(definitions[0].environment.options.listener).to.equal(listener);
    });

    it('resumes stopped execution', async () => {
      const engine = Bpmn.Engine({
        name: 'resume stopped',
        source: factory.userTask(),
      });

      let api = await engine.execute();

      await api.stop();

      expect(api.definitions[0]).to.have.property('stopped', true);

      const listener = new EventEmitter();
      listener.on('wait', (activityApi) => {
        activityApi.signal();
      });

      const completed = engine.waitFor('end');

      api = await engine.resume({ listener });

      expect(api.definitions[0]).to.have.property('stopped', false);

      return completed;
    });
  });

  describe('broker', () => {
    it('re-publishes all element activities to engine broker', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <task id="task" />
          <sequenceFlow id="flow" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      const engine = Bpmn.Engine({
        name: 'broker test',
        source,
      });
      const messages = [];
      engine.broker.subscribeTmp('event', '#', (routingKey) => {
        messages.push(routingKey);
      }, { noAck: true });

      await engine.execute();

      expect(messages).to.eql([
        'definition.enter',
        'definition.start',
        'process.init',
        'process.enter',
        'process.start',
        'activity.init',
        'activity.enter',
        'activity.start',
        'activity.execution.completed',
        'activity.end',
        'flow.pre-flight',
        'activity.leave',
        'flow.take',
        'activity.enter',
        'activity.start',
        'activity.execution.completed',
        'activity.end',
        'activity.leave',
        'process.end',
        'process.leave',
        'definition.end',
        'definition.leave',
        'engine.end',
      ]);
    });
  });

  describe('getPostponed()', () => {
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

    let engine;
    before('given an engine', () => {
      engine = Bpmn.Engine({
        name: 'get postponed',
        source
      });
    });

    it('returns activities in a postponed state', async () => {
      const listener = new EventEmitter();
      let engineApi;
      listener.once('wait', (_, api) => {
        engineApi = api;
      });

      await engine.execute({
        listener
      });

      expect(engineApi.definitions).to.have.length(1);

      const completed = engine.waitFor('end');

      engineApi.getPostponed().forEach((c) => {
        c.signal();
      });

      return completed;
    });
  });

  describe('scripts', () => {
    it('throws if unsupported script format', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="task" scriptFormat="coffeescript">
            <script>
              <![CDATA[
                if true then next() else next(new Error("tea"))
              ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      const engine = Bpmn.Engine({ source });

      try {
        await engine.execute();
      } catch (e) {
        var err = e; // eslint-disable-line
      }

      expect(err).to.be.ok;
      expect(err).to.match(/unsupported/);
    });

    it('runs through if no script body', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="task" scriptFormat="javascript" />
        </process>
      </definitions>`;

      const engine = Bpmn.Engine({ source });
      const completed = engine.waitFor('end');
      try {
        await engine.execute();
      } catch (e) {
        var err = e; // eslint-disable-line
      }

      expect(err).to.not.be.ok;
      return completed;
    });
  });

  describe('dataObjects', () => {
    it('adds dataObject values to output', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
          <dataObject id="inputFromUser" />
          <startEvent id="theStart" />
          <userTask id="userTask">
            <ioSpecification id="inputSpec">
              <dataOutput id="userInput" name="sirname" />
            </ioSpecification>
            <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
          </userTask>
          <endEvent id="theEnd" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
          <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
        </process>
      </definitions>`;

      const engine = Bpmn.Engine({ source });
      const listener = new EventEmitter();
      listener.on('wait', (userTask) => {
        expect(userTask.content).to.have.property('ioSpecification').with.property('dataOutputs').with.length(1);
        userTask.signal({
          ioSpecification: {
            dataOutputs: [{
              id: 'userInput',
              value: 'von Rosen'
            }]
          }
        });
      });

      engine.execute({ listener }, (err, api) => {
        if (err) return done(err);
        expect(api.environment.output).to.have.property('data').with.property('inputFromUser', 'von Rosen');
        done();
      });
    });
  });
});
