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
    const engine = new Bpmn.Engine(factory.resource('lanes.bpmn'));
    engine.getInstance({
      init: 1,
      request: require('request')
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
      siblings.forEach((p) => expect(p.context.variables).to.include({init: 1}));
      done();
    });

    lab.test('as shallow copy', (done) => {
      instance.context.variables.init = 2;
      instance.context.variables.mainProcess = true;

      siblings.filter((p) => p.id !== instance.id).forEach((p) => {
        expect(p.context.variables).to.include({init: 1});
        expect(p.context.variables).to.only.include(['init', 'request']);
      });

      done();
    });
  });

  lab.describe('#applyMessage', () => {
    lab.test('shallow copies message to variables', (done) => {
      const participant = siblings.find((p) => p.id !== instance.id);
      const message = {arbval: '2'};
      participant.context.applyMessage(message);

      expect(participant.context.variables).to.include({arbval: '2'});

      message.arbval = '3';
      expect(participant.context.variables).to.include({arbval: '2'});

      done();
    });
  });
});
