'use strict';

const Code = require('code');
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

const bupServiceFn = testHelpers.serviceFn;

lab.experiment('ServiceTask', () => {
  lab.after((done) => {
    testHelpers.serviceFn = bupServiceFn;
    done();
  });

  lab.describe('ctor', () => {
    lab.test('stores service name', (done) => {
      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.getInstance((err, instance) => {
        if (err) return done(err);
        const task = instance.getChildActivityById('serviceTask');
        expect(task.serviceName).to.equal('postMessage');
        done();
      });
    });
  });

  lab.describe('execute', () => {
    lab.test('executes service', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        callback();
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          done();
        });
      });
    });

    lab.test('can access variables', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        message.variables.input = 'wuiiii';
        callback();
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.input).to.equal('wuiiii');
          done();
        });
      });
    });

    lab.test('can access variables', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        message.variables.input = 'wuiiii';
        callback();
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.input).to.equal('wuiiii');
          expect(instance.getChildActivityById('serviceTask').taken).to.be.true();
          done();
        });
      });
    });

    lab.test('error in callback takes bound error event', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        callback(new Error('Failed'));
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.getChildActivityById('end').taken).to.be.false();
          expect(instance.getChildActivityById('errorEvent').taken).to.be.true();
          done();
        });
      });
    });

    lab.test('times out if bound timeout event if callback is not called within timeout duration', (done) => {
      testHelpers.serviceFn = () => {};

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.getChildActivityById('end').taken).to.be.false();
          expect(instance.getChildActivityById('timerEvent').taken).to.be.true();
          done();
        });
      });
    });
  });
});
