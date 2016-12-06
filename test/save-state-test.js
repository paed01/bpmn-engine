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

  lab.describe('engine #getState', () => {
    lab.describe('when running', () => {
      lab.test('returns state started for running execution', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.getState();
          expect(state).to.be.an.object();
          expect(state).to.include({
            state: 'started'
          });
          done();
        });

        engine.execute({
          listener: listener,
          variables: {
            input: null
          }
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.getState();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.be.an.object();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.include({
            entered: true
          });
          done();
        });

        engine.execute({
          listener: listener,
          variables: {
            input: null
          }
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns processes variables and services', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.getState();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> variables`).to.include({
            variables: {
              input: 1
            },
            services: {
              request: {
                module: 'request'
              }
            }
          });
          done();
        });

        engine.execute({
          listener: listener,
          variables: {
            input: 1
          },
          services: {
            request: {
              module: 'request'
            }
          }
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes activities', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.getState();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> tasks`).to.include('children');
          expect(state.processes[engine.entryPointId].children.find(c => c.id === 'theStart')).to.include({
            entered: false
          });
          expect(state.processes[engine.entryPointId].children.find(c => c.id === 'userTask')).to.include({
            entered: true
          });
          expect(state.processes[engine.entryPointId].children.find(c => c.id === 'theEnd')).to.include({
            entered: false
          });
          done();
        });

        engine.execute({
          listener: listener
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns source and source hash', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', () => {
          const state = engine.getState();
          expect(state.source).to.be.instanceOf(Buffer);
          expect(state.sourceHash).to.be.exist();
          done();
        });

        engine.execute({
          listener: listener
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns moddleOptions', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml,
          moddleOptions: {
            camunda: require('camunda-bpmn-moddle/resources/camunda')
          }
        });

        const listener = new EventEmitter();
        listener.on('wait-userTask', () => {
          const state = engine.getState();
          expect(state).to.include(['moddleOptions']);
          done();
        });

        engine.execute({
          listener: listener
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of task in loop', (done) => {
        const loopProcessXml = `
    <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="Process_1" isExecutable="true">
        <bpmn:userTask id="recurring" name="Each item">
          <bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.list}">
            <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">7</bpmn:loopCardinality>
          </bpmn:multiInstanceLoopCharacteristics>
        </bpmn:userTask>
      </bpmn:process>
    </bpmn:definitions>
        `;

        const engine = new Bpmn.Engine({
          source: loopProcessXml,
          moddleOptions: {
            camunda: require('camunda-bpmn-moddle/resources/camunda')
          }
        });

        const listener = new EventEmitter();
        let iteration = 0;
        listener.on('wait-recurring', (task) => {
          iteration++;

          if (iteration < 2) {
            task.signal();
          } else if (iteration === 2) {
            engine.stop();
          }
        });

        engine.execute({
          listener: listener,
          variables: {
            list: [1, 2, 3, 7]
          }
        }, (err) => {
          if (err) return done(err);
        });

        engine.once('end', () => {
          const state = engine.getState();
          const childState = state.processes[engine.entryPointId].children.find(c => c.id === 'recurring');
          expect(childState).to.include({
            entered: true,
            loop: {
              isSequential: true,
              iteration: 1,
              characteristics: {
                cardinality: 7,
                type: 'collection'
              }
            }
          });

          done();
        });
      });
    });

    lab.describe('when completed', () => {
      lab.test('returns state completed for completed execution', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal();
        });

        engine.once('end', () => {
          const state = engine.getState();
          expect(state).to.be.an.object();
          expect(state).to.include({
            state: 'completed'
          });
          done();
        });

        engine.execute({
          listener: listener,
          variables: {
            input: null
          }
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal();
        });

        engine.once('end', () => {
          const state = engine.getState();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.be.an.object();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> state`).to.include({
            entered: false
          });
          done();
        });

        engine.execute({
          listener: listener,
          variables: {
            input: null
          }
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns processes variables', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal({
            name: 'Me myself and I'
          });
        });

        engine.once('end', () => {
          const state = engine.getState();
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

        engine.execute({
          listener: listener,
          variables: {
            input: 1
          }
        }, (err) => {
          if (err) return done(err);
        });
      });

      lab.test('returns state of processes activities', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();

        listener.on('wait-userTask', (task) => {
          task.signal({
            name: 'Me myself and I'
          });
        });

        engine.once('end', () => {
          const state = engine.getState();
          expect(state.processes[engine.entryPointId], `<${engine.entryPointId}> tasks`).to.include('children');
          expect(state.processes[engine.entryPointId].children.find(c => c.id === 'theStart')).to.include({
            entered: false
          });
          expect(state.processes[engine.entryPointId].children.find(c => c.id === 'userTask')).to.include({
            entered: false
          });
          expect(state.processes[engine.entryPointId].children.find(c => c.id === 'theEnd')).to.include({
            entered: false
          });
          done();
        });

        engine.execute({
          listener: listener
        }, (err) => {
          if (err) return done(err);
        });
      });

    });
  });
});
