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
    const engine = new Bpmn.Engine(factory.resource('pool.bpmn'));
    engine.getInstance(null, null, (err, inst, sibl) => {
      if (err) return done(err);
      instance = inst;
      siblings = sibl;
      expect(siblings.length, 'No processes loaded').to.be.above(0);
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
});
