'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../');

lab.experiment('Resume execution', () => {
  const processXml = factory.userTask();

  lab.test('starts with stopped task', (done) => {
    const engine = new Bpmn.Engine(processXml);
    const listener1 = new EventEmitter();

    let state;
    listener1.once('wait-userTask', () => {
      state = engine.save();
      engine.stop();

      const listener2 = new EventEmitter();
      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      engine.resume(state, listener2, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          done();
        });
      });
    });

    engine.startInstance({
      input: null
    }, listener1, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumes stopped process even if engine is loaded with different process/version', (done) => {
    const engine1 = new Bpmn.Engine(processXml);
    const engine2 = new Bpmn.Engine(factory.valid());
    const listener1 = new EventEmitter();

    let state;
    listener1.once('wait-userTask', () => {
      state = engine1.save();
      engine1.stop();

      const listener2 = new EventEmitter();
      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      engine2.resume(state, listener2, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          done();
        });
      });
    });

    engine1.startInstance({
      input: null
    }, listener1, (err) => {
      if (err) return done(err);
    });
  });
});
