'use strict';

const Context = require('../lib/Context');
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {before, describe, it} = lab;
const {expect} = Lab.assertions;

describe('Context', () => {
  describe('getChildActivityById()', () => {
    let moddleContext;
    before((done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn').toString(), (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('returns activity instance', (done) => {
      expect(Context('mainProcess', moddleContext).getChildActivityById('mainStartEvent')).to.include(['id', 'type', 'io']);
      done();
    });

    it('returns child instance in process scope', (done) => {
      const context = Context('mainProcess', moddleContext);
      const actitivy = context.getChildActivityById('task1');
      expect(context.children).to.contain([actitivy.id]);
      done();
    });

    it('but not if out of process scope', (done) => {
      const context = new Context('mainProcess', moddleContext, {});
      const actitivy = context.getChildActivityById('meTooTask');
      expect(actitivy).to.not.exist();
      expect(context.children).to.not.contain(['meTooTask']);
      done();
    });
  });
});
