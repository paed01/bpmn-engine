'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const Bpmn = require('../');

lab.experiment('Resume execution', () => {
  const processXml = factory.userTask();

  lab.test('starts with stopped task', (done) => {
    const engine = new Bpmn.Engine(processXml, 'new');
    const listener1 = new EventEmitter();

    let state;
    listener1.on('wait-userTask', () => {
      state = engine.save();
      engine.stop();
    });

    engine.once('end', () => {

      state.processes.theProcess.variables.input = 'resumed';

      const listener2 = new EventEmitter();

      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      engine.once('end', () => {
        done();
      });

      engine.resume(state, listener2, (err) => {
        if (err) return done(err);
      });
    });

    engine.startInstance({
      input: 'start'
    }, listener1, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumes stopped process even if engine is loaded with different process/version', (done) => {
    const engine1 = new Bpmn.Engine(processXml, 'stopMe');
    const engine2 = new Bpmn.Engine(factory.valid(), 'resumeMe');
    const listener1 = new EventEmitter();

    let state;
    listener1.once('wait-userTask', () => {
      state = engine1.save();
      engine1.stop();
    });

    engine1.once('end', () => {
      const listener2 = new EventEmitter();
      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      engine2.once('end', () => {
        done();
      });

      engine2.resume(state, listener2, (err) => {
        if (err) return done(err);
      });
    });

    engine1.startInstance({
      input: null
    }, listener1, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumes stopped subprocess', (done) => {
    const engine1 = new Bpmn.Engine(factory.resource('mother-of-all.bpmn'), 'stopMe');
    const listener1 = new EventEmitter();

    listener1.on('wait-userTask1', (task) => {
      task.signal('init');
    });

    let state;
    listener1.once('wait-subUserTask1', () => {
      state = engine1.save();
      engine1.stop();
    });

    engine1.once('end', () => {
      const listener2 = new EventEmitter();

      listener2.on('wait-userTask1', (task) => {
        task.signal('resumed');
      });

      listener2.on('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.on('end-subUserTaskTimer', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.on('wait-subUserTask1', (task) => {
        task.signal('Continue');
      });

      const engine2 = new Bpmn.Engine(factory.valid(), 'resumeMe');
      engine2.resume(state, listener2, (err, resumedInstance) => {
        if (err) return done(err);

        resumedInstance.once('end', () => {
          expect(resumedInstance.variables.taskInput.userTask1).to.equal('resumed');
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
