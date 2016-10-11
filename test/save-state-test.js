'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const Bpmn = require('../');
const expect = Code.expect;

lab.experiment('Save state', () => {
  const processXml = factory.userTask();

  lab.describe('engine #save', () => {
    lab.describe('when running', () => {
      lab.test('returns state started for running execution', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.save();
          expect(state).to.be.an.object();
          expect(state).to.include({
            state: 'started'
          });
          done();
        });

        engine.startInstance({
          input: null
        }, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.save();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.be.an.object();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.include({
            entered: true
          });
          done();
        });

        engine.startInstance({
          input: null
        }, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns processes variables', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.save();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> variables`).to.include({
            variables: {
              input: 1
            }
          });
          done();
        });

        engine.startInstance({
          input: 1
        }, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes activities', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.save();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> tasks`).to.include('children');
          expect(state.processes[engine.entryPointId].children.theStart).to.include({entered: false});
          expect(state.processes[engine.entryPointId].children.userTask).to.include({entered: true});
          expect(state.processes[engine.entryPointId].children.theEnd).to.include({entered: false});
          done();
        });

        engine.startInstance(null, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns source and source hash', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.save();
          expect(state.source).to.be.instanceOf(Buffer);
          expect(state.sourceHash).to.be.exist();
          done();
        });

        engine.startInstance(null, listener, (err) => {
          if (err) return done(err);
        });
      });
    });

    lab.describe('when completed', () => {
      lab.test('returns state completed for completed execution', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal();
        });

        engine.once('end', () => {
          const state = engine.save();
          expect(state).to.be.an.object();
          expect(state).to.include({
            state: 'completed'
          });
          done();
        });

        engine.startInstance({
          input: null
        }, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal();
        });

        engine.once('end', () => {
          const state = engine.save();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.be.an.object();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.include({
            entered: false
          });
          done();
        });

        engine.startInstance({
          input: null
        }, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns processes variables', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal({
            name: 'Me myself and I'
          });
        });

        engine.once('end', () => {
          const state = engine.save();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> variables`).to.include({
            variables: {
              input: 1,
              inputFromUser: {
                name: 'Me myself and I'
              }
            }
          });
          done();
        });

        engine.startInstance({
          input: 1
        }, listener, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes activities', (done) => {
        const engine = new Bpmn.Engine(processXml);
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal({
            name: 'Me myself and I'
          });
        });

        engine.once('end', () => {
          const state = engine.save();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> tasks`).to.include('children');
          expect(state.processes[engine.entryPointId].children.theStart).to.include({entered: false});
          expect(state.processes[engine.entryPointId].children.userTask).to.include({entered: false});
          expect(state.processes[engine.entryPointId].children.theEnd).to.include({entered: false});
          done();
        });

        engine.startInstance(null, listener, (err) => {
          if (err) return done(err);
        });
      });

    });
  });
});
