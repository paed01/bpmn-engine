'use strict';

const Code = require('code');
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('Task', () => {
  let task;
  lab.beforeEach((done) => {
    const engine = new Bpmn.Engine(factory.resource('simple-task.bpmn'));
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      task = execution.getChildActivityById('task');
      done();
    });
  });

  lab.test('should store boundardy events', (done) => {
    expect(task.boundEvents.length).to.equal(1);
    done();
  });

  lab.test('attaches event listener when runned', (done) => {
    task.run();

    expect(task.boundEvents[0].listenerCount('end')).to.equal(1);
    expect(task.boundEvents[0].listenerCount('cancel')).to.equal(1);

    done();
  });

  lab.test('that are removed when completed', (done) => {
    task.run();

    task.once('leave', () => {
      expect(task.boundEvents[0].listenerCount('end')).to.equal(0);
      expect(task.boundEvents[0].listenerCount('cancel')).to.equal(0);
      done();
    });
  });

  lab.describe('#setupBoundEventListeners', () => {
    lab.test('sets up listeners', (done) => {
      task.setupBoundEventListeners();

      expect(task.boundEvents[0].listenerCount('end')).to.equal(1);
      expect(task.boundEvents[0].listenerCount('cancel')).to.equal(1);

      done();
    });

    lab.test('sets up listeners once', (done) => {
      task.setupBoundEventListeners();
      task.setupBoundEventListeners();

      expect(task.boundEvents[0].listenerCount('end')).to.equal(1);
      expect(task.boundEvents[0].listenerCount('cancel')).to.equal(1);

      done();
    });
  });

  lab.describe('#teardownBoundEventListeners', () => {
    lab.test('tears down listeners', (done) => {
      task.setupBoundEventListeners();
      task.teardownBoundEventListeners();

      expect(task.boundEvents[0].listenerCount('end')).to.equal(0);
      expect(task.boundEvents[0].listenerCount('cancel')).to.equal(0);

      done();
    });

    lab.test('tears down listeners once', (done) => {
      task.setupBoundEventListeners();
      task.teardownBoundEventListeners();
      task.teardownBoundEventListeners();

      expect(task.boundEvents[0].listenerCount('end')).to.equal(0);
      expect(task.boundEvents[0].listenerCount('cancel')).to.equal(0);

      done();
    });
  });
});
