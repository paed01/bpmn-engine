'use strict';

const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');
const {Engine} = require('../');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('Lanes', () => {
  const source = factory.resource('lanes.bpmn');

  it('main process stores outbound messageFlows', (done) => {
    const engine = new Engine({
      source
    });
    engine.getDefinitions((err, definitions) => {
      if (err) return done(err);

      expect(definitions[0].getProcesses()[0].context.messageFlows.length).to.equal(1);

      done();
    });
  });

  it('completes process', (done) => {
    const listener = new EventEmitter();
    const engine = new Engine({
      source
    });

    engine.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine);
      done();
    });

    engine.execute({
      listener,
      variables: {
        input: 0
      }
    }, (err) => {
      if (err) return done(err);
    });
  });

  it('participant startEvent receives and stores message on process context', (done) => {
    const listener = new EventEmitter();
    const engine = Engine({
      source
    });

    listener.on('start-task1', (activityApi) => {
      activityApi.signal({
        message: 'I\'m done',
        arbval: '10'
      });
    });

    listener.on('start-completeTask', (activityApi) => {
      activityApi.signal({
        message: 'Done aswell'
      });
    });

    listener.once('end-messageStartEvent', (activityApi) => {
      expect(activityApi.getOutput()).to.equal({
        message: 'I\'m done',
        arbval: '10'
      });
    });

    listener.once('end-participantEndEvent', (activityApi, processExecution) => {
      expect(processExecution.getOutput().taskInput.messageStartEvent).to.include({
        message: 'I\'m done'
      });
    });

    listener.once('end-mainEndEvent', (activityApi, processExecution) => {
      expect(processExecution.getOutput().taskInput.intermediate).to.include({
        message: 'Done aswell'
      });
    });

    engine.once('end', (execution, definitionExecution) => {
      expect(definitionExecution.getOutput()).to.include(['taskInput']);
      done();
    });

    engine.execute({
      listener,
      variables: {
        input: 0
      }
    }, (err) => {
      if (err) return done(err);
    });
  });
});
