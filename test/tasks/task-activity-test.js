'use strict';

const factory = require('../helpers/factory');
const Lab = require('lab');
const Process = require('../../lib/activities/Process');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../lib');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('task activity', () => {

  describe('cancel()', () => {
    it('cancels bound events and takes all outbound', (done) => {
      const engine = new Engine({
        source: factory.resource('boundary-timeout.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait-userTask', (activityApi) => {
        activityApi.cancel();
      });

      engine.execute({
        listener
      });

      engine.once('end', (execution, definitionExecution) => {
        expect(definitionExecution.getChildState('join').taken, 'join').to.be.true();
        expect(definitionExecution.getChildState('end').taken, 'end').to.be.true();
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });

  describe('multiple inbounds', () => {
    it('completes process', (done) => {
      const engine = new Engine({
        source: factory.resource('task-multiple-inbound.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait', (activity) => {
        activity.signal({
          input: 1
        });
      });

      let taskCount = 0;
      listener.on('end-script', (a) => {
        taskCount++;
        if (taskCount > 3) {
          fail(`Too many runs for <${a.id}>`);
        }
      });

      engine.execute({
        listener,
        variables: {
          input: 0
        }
      });

      engine.once('end', () => {
        done();
      });
    });

    it('multiple multiple completes process', (done) => {
      const engine = new Engine({
        source: factory.resource('multiple-multiple-inbound.bpmn'),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      let taskCount = 0;
      listener.on('start-task', (a) => {
        taskCount++;
        if (taskCount > 3) {
          fail(`Too many runs (${taskCount}) for <${a.id}>`);
        }
      });

      engine.once('end', (execution, definitionExecution) => {
        expect(taskCount, 'start tasks').to.equal(3);
        expect(definitionExecution.getOutput()).to.equal({
          tookCondition1: true,
          tookCondition2: true,
          condition1: true,
          condition2: true
        });
        expect(definitionExecution.getChildState('end').taken).to.be.true();
        done();
      });

      engine.execute({
        listener
      });

    });
  });

  describe('in lane with outbound message', () => {
    it('will have outbound that point to other lane', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const mainProcess = new Process(moddleContext.elementsById.mainProcess, moddleContext);
        const task = mainProcess.getChildActivityById('task1');
        expect(task.outbound).to.have.length(2);
        done();
      });
    });
  });
});
