'use strict';

const Code = require('code');
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('..');
const Context = require('../lib/Context');
const Definition = require('../lib/Definition');
const Activity = require('../lib/activities/Activity');

lab.experiment('Context', () => {
  let instance, siblings;
  lab.before((done) => {
    const engine = new Bpmn.Engine({
      source: factory.resource('lanes.bpmn')
    });
    engine.getDefinition((err1, definition) => {
      if (err1) return done(err1);
      definition.getProcesses({
        variables: {
          init: 1
        }
      }, (err, inst, sibl) => {
        if (err) return done(err);
        instance = inst;
        siblings = sibl;
        expect(siblings.length, 'No processes loaded').to.be.above(1);
        done();
      });
    });
  });

  lab.describe('process instance', () => {
    lab.test('gets instantiated with processes', (done) => {
      siblings.forEach((p) => expect(p.context).to.be.instanceof(Context));
      done();
    });

    lab.test('loads children in process context', (done) => {
      siblings.forEach((p) => expect(Object.keys(p.context.children).length).to.be.above(0));
      done();
    });
  });


  lab.describe('variables', () => {
    lab.test('initiating variables are stored for each context', (done) => {
      siblings.forEach((p) => expect(p.context.variables).to.include({
        init: 1
      }));
      done();
    });

    lab.test('as shallow copy', (done) => {
      instance.context.variables.init = 2;
      instance.context.variables.mainProcess = true;

      siblings.filter((p) => p.id !== instance.id).forEach((p) => {
        expect(p.context.variables).to.include({
          init: 1
        });
        expect(p.context.variables).to.only.include(['init']);
      });

      done();
    });
  });

  lab.describe('getChildActivityById()', () => {
    lab.test('returns activity instance', (done) => {
      expect(instance.context.getChildActivityById('mainStartEvent')).to.be.instanceof(Activity);
      done();
    });

    lab.test('returns child instance', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (merr, result) => {
        if (merr) return done(merr);
        const context = new Context('mainProcess', result, {});
        const actitivy = context.getChildActivityById('task1');
        expect(context.children).to.contain([actitivy.id]);
        done();
      });
    });

    lab.test('but not if it is not in process scope', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (merr, result) => {
        if (merr) return done(merr);
        const context = new Context('mainProcess', result, {});
        const actitivy = context.getChildActivityById('meTooTask');
        expect(actitivy).to.not.exist();
        expect(context.children).to.not.contain(['meTooTask']);
        done();
      });
    });
  });

  lab.describe('applyMessage()', () => {
    lab.test('shallow copies message to variables', (done) => {
      const participant = siblings.find((p) => p.id !== instance.id);
      const message = {
        arbval: '2'
      };
      participant.context.applyMessage(message);

      expect(participant.context.variables).to.include({
        arbval: '2'
      });

      message.arbval = '3';
      expect(participant.context.variables).to.include({
        arbval: '2'
      });

      done();
    });
  });

  lab.describe('getState()', () => {
    lab.test('returns variables, services and children', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (gerr, moddleContext) => {
        if (gerr) return done(gerr);

        const definition = new Definition(moddleContext);

        definition.getProcesses({
          variables: {
            init: 1,
            loadedAt: new Date(),
            myArray: [1, 2, 3, 5],
          },
          services: {
            request: {
              type: 'require',
              module: 'request'
            },
            myFuncs: {
              type: 'require',
              module: './helpers/testHelpers'
            }
          }
        }, (err, inst) => {
          if (err) return done(err);
          instance = inst;

          const state = instance.context.getState();

          expect(state).to.only.include(['variables', 'services', 'children']);

          expect(state.variables).to.only.include(['init', 'loadedAt', 'myArray']);
          expect(state.services).to.include(['request', 'myFuncs']);
          expect(state.services.myFuncs).to.include({
            type: 'require',
            module: './helpers/testHelpers'
          });
          expect(state.services.request).to.include({
            type: 'require',
            module: 'request'
          });

          done();
        });
      });

    });
  });

  lab.describe('getVariablesAndServices()', () => {
    lab.test('returns resolved services', (done) => {
      testHelpers.getContext(factory.valid(), (err, context) => {
        if (err) return done(err);

        context.services = {
          none: {},
          whut: {
            type: 'misc'
          },
          fn: () => {},
          get: {
            module: 'request',
            fnName: 'get'
          },
          request: {
            module: 'request'
          },
          console: {
            module: 'console',
            type: 'global'
          },
          log: {
            module: 'console',
            type: 'global',
            fnName: 'log'
          },
          require: {
            module: 'require',
            type: 'global'
          }
        };

        const services = context.getVariablesAndServices().services;

        expect(services.none).to.be.undefined();
        expect(services.whut).to.be.undefined();
        expect(services.fn).to.be.a.function();
        expect(services.get).to.be.a.function();
        expect(services.request).to.be.a.function();
        expect(services.console).to.be.an.object();
        expect(services.log).to.be.a.function();
        expect(services.require).to.be.a.function();

        done();
      });

    });

    lab.test('takes options and assigns to result', (done) => {
      testHelpers.getContext(factory.valid(), (err, context) => {
        if (err) return done(err);

        context.services = {
          get: {
            module: 'request',
            fnName: 'get'
          }
        };

        const executionContext = context.getVariablesAndServices({
          id: 'test'
        });

        expect(executionContext).to.include({
          id: 'test'
        });
        done();
      });

    });

  });

  lab.describe('getFrozenVariablesAndServices()', () => {
    lab.test('returns frozen variables and services', (done) => {
      testHelpers.getContext(factory.valid(), (err, context) => {
        if (err) return done(err);

        context.variables = {
          input: 1
        };
        context.services = {
          fn: () => {},
          get: {
            module: 'request',
            fnName: 'get'
          }
        };

        const executionContext = context.getFrozenVariablesAndServices().services;

        expect(Object.isFrozen(executionContext.services)).to.be.true();
        expect(Object.isFrozen(executionContext.variables)).to.be.true();
        done();
      });

    });

    lab.test('options are returned', (done) => {
      testHelpers.getContext(factory.valid(), (err, context) => {
        if (err) return done(err);

        context.variables = {
          input: 1
        };
        context.services = {
          fn: () => {},
          get: {
            module: 'request',
            fnName: 'get'
          }
        };

        const executionContext = context.getFrozenVariablesAndServices({
          id: 'test'
        });
        expect(executionContext).to.include({
          id: 'test'
        });
        done();
      });

    });

  });

  lab.describe('getServiceByName()', () => {
    lab.test('returns service function', (done) => {
      testHelpers.getContext(factory.valid(), (err, context) => {
        if (err) return done(err);

        context.services = {
          get: {
            module: 'request',
            fnName: 'get'
          }
        };

        const service = context.getServiceByName('get');

        expect(service).to.be.a.function();
        done();
      });
    });

    lab.test('returns undefined if service is not found', (done) => {
      testHelpers.getContext(factory.valid(), (err, context) => {
        if (err) return done(err);

        context.services = {
          get: {
            module: 'request',
            fnName: 'get'
          }
        };

        const service = context.getServiceByName('put');

        expect(service).to.be.undefined();
        done();
      });
    });

  });

  lab.describe('getActivityForm()', () => {
    lab.test('returns form instance', (done) => {
      testHelpers.getContext(factory.resource('forms.bpmn').toString(), {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);

        const activity = context.getChildActivityById('start').activity;
        expect(context.getActivityForm(activity)).to.exist();
        done();
      });
    });

    lab.test('returns undefined if no activity', (done) => {
      testHelpers.getContext(factory.resource('forms.bpmn').toString(), {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);
        expect(context.getActivityForm()).to.be.undefined();
        done();
      });
    });
  });
});
