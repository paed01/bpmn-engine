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
      expect(engine.source).to.exist();
      done();
    });

    lab.test('takes moddleOptions as option', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid(),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      expect(engine.source).to.exist();
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
      expect(() => {
        new Bpmn.Engine({
          name: 'no source'
        }); /* eslint no-new: 0 */
      }).to.not.throw();
      done();
    });

    lab.test('accepts context as object', (done) => {
      expect(() => {
        new Bpmn.Engine({
          context: {}
        }); /* eslint no-new: 0 */
      }).to.not.throw();
      done();
    });
  });

  lab.experiment('getInstance()', () => {
    lab.test('after transform engine id is definition id', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid('myValidDefinition')
      });
      engine.getInstance(() => {
        expect(engine.id).to.equal('myValidDefinition');
        done();
      });
    });

    lab.test('returns error in callback if no source', (done) => {
      const engine = new Bpmn.Engine();
      engine.getInstance((err) => {
        expect(err).to.be.an.error(/context is required if no source/);
        done();
      });
    });

    lab.test('returns instance of passed moddle context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.valid('contextTest'), (moddleErr, definition, context) => {
        if (moddleErr) return done(moddleErr);
        const engine = new Bpmn.Engine({
          context: context
        });
        engine.getInstance((err) => {
          if (err) return done(err);
          expect(engine.id).to.equal('contextTest');
          done();
        });
      });
    });

    lab.test('returns instance of passed deserialized moddle context', (done) => {
      const moddle = new BpmnModdle();
      moddle.fromXML(factory.valid('contextTest'), (moddleErr, definition, context) => {
        if (moddleErr) return done(moddleErr);
        const engine = new Bpmn.Engine({
          context: JSON.parse(testHelpers.serializeModdleContext(context))
        });
        engine.getInstance((err) => {
          if (err) return done(err);
          expect(engine.id).to.equal('contextTest');
          done();
        });
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

    lab.test('sets entry point id to executable process', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.valid()
      });
      engine.execute((err) => {
        expect(err).to.not.exist();
        expect(engine.entryPointId).to.equal('theProcess1');
        done();
      });
    });

    lab.test('returns error in callback if no source', (done) => {
      const engine = new Bpmn.Engine({
        source: ''
      });
      engine.execute((err) => {
        expect(err).to.exist();
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

    lab.test('emits end when all processes are completed', (done) => {
      const engine = new Bpmn.Engine({
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
          context: JSON.parse(testHelpers.serializeModdleContext(context))
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

    lab.describe('options', () => {
      lab.test('returns error in callback if listener doesn´t have an emit function', (done) => {
        const engine = new Bpmn.Engine({
          source: factory.resource('lanes.bpmn')
        });
        engine.execute({
          listener: {}
        }, (err) => {
          expect(err).to.be.an.error(/\"emit\" is required/);
          done();
        });
      });

      lab.test('returns error in callback if service type is not "global" or "require"', (done) => {
        const engine = new Bpmn.Engine({
          source: factory.resource('lanes.bpmn')
        });
        engine.execute({
          services: {
            test: {
              module: 'require',
              type: 'misc'
            }
          }
        }, (err) => {
          expect(err).to.be.an.error(/must be one of/);
          done();
        });
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
