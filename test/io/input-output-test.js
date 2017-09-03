'use strict';

const {Engine} = require('../../.');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('input/output', () => {
  let context;
  const source = factory.resource('service-task-io-types.bpmn').toString();
  beforeEach((done) => {
    testHelpers.getContext(source, {
      camunda: require('camunda-bpmn-moddle/resources/camunda')
    }, (err, result) => {
      if (err) return done(err);
      context = result;
      done();
    });
  });

  describe('activity io', () => {
    it('getInput() with undefined io returns undefined', (done) => {
      const task = context.getChildActivityById('StartEvent_1');
      expect(task).to.include(['io']);
      expect(task.io).to.exist();
      expect(task.io.isDefault).to.equal(true);

      expect(task.io.getInput()).to.be.undefined();

      done();
    });

    it('getOutput() with undefined io returns undefined', (done) => {
      const task = context.getChildActivityById('StartEvent_1');

      expect(task.io.getOutput()).to.be.undefined();

      done();
    });

    it('setOutputValue() assigns result', (done) => {
      const task = context.getChildActivityById('StartEvent_1');

      task.io.setOutputValue('name', 'me');
      expect(task.io.getOutput()).to.equal({name: 'me'});

      done();
    });

    it('setOutputValue() assigns result', (done) => {
      const task = context.getChildActivityById('StartEvent_1');

      task.io.setOutputValue('name', 'me');
      expect(task.io.getOutput()).to.equal({name: 'me'});

      done();
    });

    it('setOutputValue() assigns result property', (done) => {
      const task = context.getChildActivityById('StartEvent_1');

      task.io.setResult({
        input: 1
      });
      task.io.setOutputValue('name', 'me');
      expect(task.io.getOutput()).to.equal({
        input: 1,
        name: 'me'
      });

      done();
    });
  });

  describe('element property io', () => {
    it('getInput() returns empty', (done) => {
      const task = context.getChildActivityById('errorBoundaryEvent');
      expect(task).to.include(['io']);
      expect(task.io).to.exist();


      task.on('enter', (activityApi, activityExecution) => {
        const errorDefIO = activityApi.getEvents()[0].io;
        errorDefIO.setResult({
          name: 'me'
        });

        const api = activityApi.getApi(activityExecution);
        expect(api.getInput()).to.be.empty();
        done();
      });

      task.activate().run();
    });

    it('getOutput() returns assigned result', (done) => {
      const event = context.getChildActivityById('errorBoundaryEvent');

      event.on('enter', (activityApi) => {
        const errorDefIO = activityApi.getEvents()[0].io;
        errorDefIO.setResult({
          name: 'me'
        });
      });

      event.on('end', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        expect(api.getOutput()).to.equal({
          name: 'me',
          errorMessage: 'Expected',
          errorCode: undefined
        });

        done();
      });

      const eventActivity = event.activate();
      eventActivity.attachedTo.activate().run({
        error: 'Expected'
      });
    });
  });

  describe('camunda input/output', () => {
    it('setOutputValue() assigns result', (done) => {
      const task = context.getChildActivityById('serviceTask');

      task.io.setOutputValue('result', [{
        statusCode: 200
      }, 'HTML']);
      expect(task.io.getOutput()).to.equal({
        statusCode: 200,
        body: 'HTML'
      });

      done();
    });

    it('setOutputValue() assigns result property', (done) => {
      const task = context.getChildActivityById('serviceTask');

      task.io.setResult({
        input: 1
      });
      task.io.setOutputValue('result', [{
        statusCode: 200
      }, 'HTML']);
      expect(task.io.getOutput()).to.equal({
        statusCode: 200,
        body: 'HTML'
      });

      done();
    });
  });

  describe('service task with camunda input/output', () => {
    describe('getInput()', () => {
      it('return object with named input arguments', (done) => {
        context.environment.assignVariables({
          apiPath: 'http://example-2.com',
          input: 2
        });

        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        const args = task.io.getInput();
        expect(args).to.equal({
          options: {
            uri: 'http://example-2.com'
          },
          input: 2,
          inputConstant: 'hard coded value',
          list: [2, '2'],
          path: undefined
        });

        done();
      });
    });

    describe('getOutput()', () => {
      it('returns object mapped to array arguments', (done) => {
        context.environment.assignVariables({
          apiPath: 'http://example-2.com',
          input: 2
        });

        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        task.io.setResult([{
          statusCode: 200,
          path: '/api/v4'
        }, {
          data: 1
        }]);

        const args = task.io.getOutput();
        expect(args).to.equal({
          statusCode: 200,
          body: {
            data: 1
          }
        });

        done();
      });
    });
  });

  describe('user task', () => {
    describe('getInput()', () => {

      it('return object with named input arguments', (done) => {
        context.environment.assignVariables({
          input: 2
        });

        const task = context.getChildActivityById('userTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        const args = task.io.getInput({
          text: 'accept me'
        });
        expect(args).to.equal({
          message: 'accept me',
          inputScript: 2
        });

        done();
      });

    });

    describe('getOutput()', () => {

      it('returns mapped output from result object', (done) => {
        context.environment.assignVariables({
          apiPath: 'http://example-2.com',
          input: 2
        });

        const task = context.getChildActivityById('userTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        task.io.setResult({
          accept: 'No',
          managerEmail: 'boss@example.com',
          timestamp: 1484870400000
        });

        const args = task.io.getOutput();
        expect(args).to.equal({
          accepted: false,
          managerEmail: 'boss@example.com',
          original: {
            accept: 'No',
            timestamp: 1484870400000
          }
        });

        done();
      });

    });

  });

  describe('script task', () => {
    describe('getInput()', () => {

      it('return object with named input arguments', (done) => {
        context.environment.assignVariables({
          input: 2
        });

        const task = context.getChildActivityById('scriptTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        const args = task.io.getInput({
          inputValue: 2
        });
        expect(args).to.equal({
          input1: 2,
          input2: '3',
          error: undefined
        });

        done();
      });

    });

    describe('getOutput()', () => {

      it('without output parameters returns unaltered output from script', (done) => {
        context.environment.assignVariables({
          apiPath: 'http://example-2.com',
          input: 2
        });

        const task = context.getChildActivityById('scriptTask');

        task.once('end', (activityApi, executionContext) => {
          expect(executionContext.getOutput()).to.equal([2, '3']);
          done();
        });

        task.activate().run({
          inputValue: 2
        });
      });
    });

  });

  describe('engine', () => {
    it('saves to environment variables', (done) => {
      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.on('wait-userTask', (activityApi) => {
        expect(activityApi.getInput()).to.equal({
          inputScript: 42,
          message: undefined
        });
        activityApi.signal({
          accept: 'Yes',
          managerEmail: 'a@b.c',
          timestamp: new Date('1986-12-12T01:01Z')
        });
      });
      listener.on('end-userTask', (activityApi) => {
        expect(activityApi.getOutput()).to.equal({
          accepted: true,
          managerEmail: 'a@b.c',
          original: {
            accept: 'Yes',
            timestamp: new Date('1986-12-12T01:01Z')
          }
        });
      });
      listener.on('start-serviceTask', (activityApi) => {
        expect(activityApi.getInput()).to.equal({
          input: 42,
          inputConstant: 'hard coded value',
          list: [42, '2'],
          options: {
            uri: 'http://example-2.com'
          },
          path: undefined
        });
      });
      listener.on('end-serviceTask', (activityApi) => {
        expect(activityApi.getOutput()).to.equal({
          statusCode: 200,
          body: {}
        });
      });

      listener.on('enter-scriptTask', (activityApi) => {
        expect(activityApi.getInput()).to.equal({
          input1: undefined,
          input2: '3',
          error: undefined
        });
      });

      engine.execute({
        listener,
        services: {
          get: (arg, next) => {
            next(null, {
              statusCode: 200
            }, {});
          }
        },
        variables: {
          apiPath: 'http://example-2.com',
          input: 42
        }
      });

      engine.on('end', (e, def) => {
        expect(def.environment.getOutput()).to.equal({
          accepted: true,
          body: {},
          managerEmail: 'a@b.c',
          original: {
            accept: 'Yes',
            timestamp: new Date('1986-12-12T01:01Z')
          },
          statusCode: 200
        });
        done();
      });
    });
  });
});
