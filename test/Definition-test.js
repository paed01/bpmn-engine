'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');
const Definition = require('../lib/mapper').Definition;
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('..');

lab.experiment('Definition', () => {
  lab.experiment('ctor', () => {
    let moddleContext;
    lab.before((done) => {
      Bpmn.Transformer.transform(factory.valid('testingCtor'), {}, (err, def, context) => {
        moddleContext = context;
        done(err);
      });
    });

    lab.test('throws without arguments', (done) => {
      expect(() => {
        new Definition(); // eslint-disable-line no-new
      }).to.throw(/No moddle context/);
      done();
    });

    lab.test('throws if invalid options', (done) => {
      expect(() => {
        new Definition(moddleContext, {  // eslint-disable-line no-new
          services: {
            invalid: {
              type: 'require'
            }
          }
        });
      }).to.throw(Error);
      done();
    });

    lab.test('takes moddle context as first argument', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.moddleContext).to.exist();
      done();
    });

    lab.test('stores id on instance', (done) => {
      const definition = new Definition(moddleContext);
      expect(definition.id).to.equal('testingCtor');
      done();
    });

    lab.test('takes option listener', (done) => {
      const definition = new Definition(moddleContext, {
        listener: new EventEmitter()
      });
      expect(definition.listener).to.exist();
      done();
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
  });

  lab.describe('execute options', () => {
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
});
