'use strict';

const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('input/output', () => {
  let context;
  beforeEach((done) => {
    const processXml = factory.resource('service-task-io-types.bpmn').toString();
    testHelpers.getContext(processXml, {
      camunda: require('camunda-bpmn-moddle/resources/camunda')
    }, (err, result) => {
      if (err) return done(err);
      context = result;
      done();
    });
  });

  describe('service task with camunda input/output', () => {
    describe('getInput()', () => {

      it('return object with named input arguments', (done) => {
        context.variables = {
          apiPath: 'http://example-2.com',
          input: 2
        };

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
        context.variables = {
          apiPath: 'http://example-2.com',
          input: 2
        };

        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        const args = task.io.getOutput([{
          statusCode: 200,
          path: '/api/v4'
        }, {
          data: 1
        }]);
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
        context.variables = {
          input: 2
        };

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
        context.variables = {
          apiPath: 'http://example-2.com',
          input: 2
        };

        const task = context.getChildActivityById('userTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        const args = task.io.getOutput({
          accept: 'No',
          managerEmail: 'boss@example.com',
          timestamp: 1484870400000
        });
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
        context.variables = {
          input: 2
        };

        const task = context.getChildActivityById('scriptTask');
        expect(task).to.include(['io']);
        expect(task.io).to.exist();

        const args = task.io.getInput({
          inputValue: 2
        });
        expect(args).to.equal({
          input1: 2,
          input2: '3'
        });

        done();
      });

    });

    describe('getOutput()', () => {

      it('without output parameters returns unaltered output from script', (done) => {
        context.variables = {
          apiPath: 'http://example-2.com',
          input: 2
        };

        const task = context.getChildActivityById('scriptTask');

        task.once('end', (activity, output) => {
          expect(output).to.equal([2, '3']);
          done();
        });

        task.enter();
        task.execute({
          inputValue: 2
        });
      });
    });

  });
});
