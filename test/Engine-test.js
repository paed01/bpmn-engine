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

lab.experiment('engine', () => {
  lab.test('Bpmn exposes executor module', (done) => {
    expect(Bpmn).to.include('Engine');
    done();
  });

  lab.experiment('ctor', () => {
    lab.test('without arguments', (done) => {
      expect(() => {
        new Bpmn.Engine(); /* eslint no-new: 0 */
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
        new Bpmn.Engine({
          source: source
        }); /* eslint no-new: 0 */
      }).to.throw();
      done();
    });

    lab.test('accepts name', (done) => {
      let engine;
      expect(() => {
        engine = new Bpmn.Engine({
          name: 'no source'
        }); /* eslint no-new: 0 */
      }).to.not.throw();

      expect(engine.name).to.equal('no source');

      done();
    });

    lab.test('accepts moddleContext as object', (done) => {
      expect(() => {
        new Bpmn.Engine({
          moddleContext: {}
        }); /* eslint no-new: 0 */
      }).to.not.throw();
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
  });

  lab.describe('execute()', () => {
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
        source: processXml
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', () => {
        const state = engine.getState();
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

  lab.describe('resume()', () => {
    lab.test('with invalid source returns error in callback', (done) => {
      const engine = new Bpmn.Engine();
      engine.resume({
        source: 'invalid xml'
      }, (err) => {
        expect(err).to.be.an.error(/data outside of root node/);
        done();
      });
    });
  });
});
