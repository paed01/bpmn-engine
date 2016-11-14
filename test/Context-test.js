'use strict';

const Code = require('code');
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('..');
const Context = require('../lib/Context');
const Activity = require('../lib/activities/Activity');

lab.experiment('Context', () => {
  let instance, siblings;
  lab.before((done) => {
    const engine = new Bpmn.Engine({
      source: factory.resource('lanes.bpmn')
    });
    engine.getInstance({
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

  lab.describe('#getChildActivityById', () => {
    lab.test('returns activity instance', (done) => {
      expect(instance.context.getChildActivityById('mainStartEvent')).to.be.instanceof(Activity);
      done();
    });

    lab.test('throws if child was not found', (done) => {
      expect(() => {
        instance.context.getChildActivityById('no-mainStartEvent');
      }).to.throw(Error, /no-mainStartEvent/);
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

  lab.describe('#applyMessage', () => {
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

  lab.describe('#getState', () => {
    lab.test('returns variables, services and children', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.resource('lanes.bpmn')
      });
      engine.getInstance({
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

  lab.describe('#getVariablesAndServices', () => {
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

  });
});
