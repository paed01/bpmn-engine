'use strict';

const Code = require('code');
const factory = require('./helpers/factory');
const Lab = require('lab');

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
    }, null, (err, inst, sibl) => {
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
    lab.test('returns variables and services', (done) => {
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
      }, null, (err, inst) => {
        if (err) return done(err);
        instance = inst;

        const state = instance.context.getState();

        expect(state).to.only.include(['variables', 'services']);

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
