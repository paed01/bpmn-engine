'use strict';

const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;
const nock = require('nock');
const testHelpers = require('./helpers/testHelpers');
const factory = require('./helpers/factory');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../');

lab.experiment('issues', () => {
  lab.describe('issue 19 - save state', () => {

    lab.test('make sure there is something to save on listener start events', (done) => {
      const messages = [];
      testHelpers.serviceLog = (message) => {
        messages.push(message);
      };
      testHelpers.serviceTimeout = (cb, time) => {
        setTimeout(cb, time);
      };

      let state;
      const engine = new Bpmn.Engine({
        source: factory.resource('issue-19.bpmn')
      });
      const listener = new EventEmitter();

      listener.on('start', () => {
        state = engine.getState();
      });

      listener.once('start-Task_B', () => {
        setImmediate(() => {
          engine.stop();
          state = engine.getState();
        });
      });

      engine.once('end', () => {
        const listener2 = new EventEmitter();
        const engine2 = Bpmn.Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', () => {
          expect(messages).to.equal([
            'Waiting Task B for 5 seconds...',
            'Waiting Task B for 5 seconds...',
            'Resume Task B!',
            'Resume Task B!'
          ]);
          done();
        });
      });

      engine.execute({
        listener: listener,
        variables: {
          timeout: 100
        },
        services: {
          timeout: {
            module: require.resolve('./helpers/testHelpers'),
            fnName: 'serviceTimeout'
          },
          log: {
            module: require.resolve('./helpers/testHelpers'),
            fnName: 'serviceLog'
          }
        }
      });

    });
  });

  lab.describe('issue-19 - on error', () => {
    let services;
    lab.before((done) => {
      testHelpers.statusCodeOk = (statusCode) => {
        return statusCode === 200;
      };
      testHelpers.extractErrorCode = (errorMessage) => {
        if (!errorMessage) return;
        const codeMatch = errorMessage.match(/^([A-Z_]+):.+/);
        if (codeMatch) return codeMatch[1];
      };

      services = {
        get: {
          module: 'request',
          fnName: 'get'
        },
        statusCodeOk: {
          module: require.resolve('./helpers/testHelpers'),
          fnName: 'statusCodeOk'
        },
        extractErrorCode: {
          module: require.resolve('./helpers/testHelpers'),
          fnName: 'extractErrorCode'
        }
      };

      done();
    });

    lab.test('completes when returning to request after resume', (done) => {
      testHelpers.statusCodeOk = (statusCode) => {
        return statusCode === 200;
      };

      let state;
      const engine = new Bpmn.Engine({
        source: factory.resource('issue-19-2.bpmn'),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener = new EventEmitter();

      listener.on('start', () => {
        state = engine.getState();
      });

      listener.once('wait-waitForSignalTask', () => {
        state = engine.getState();
        engine.stop();
      });

      engine.once('end', () => {
        const listener2 = new EventEmitter();
        listener2.once('wait-waitForSignalTask', (task) => {
          task.signal();
        });

        nock('http://example.com')
          .get('/api')
          .reply(200, {
            status: 'OK'
          });

        const engine2 = Bpmn.Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', (def) => {
          expect(def.variables).to.include({
            statusCode: 200,
            body: {
              status: 'OK'
            }
          });
          done();
        });
      });

      nock('http://example.com')
        .get('/api')
        .reply(502);

      engine.execute({
        listener: listener,
        variables: {
          apiUrl: 'http://example.com/api',
          timeout: 'PT0.1S'
        },
        services: services
      });

    });

    lab.test('caught error is saved to variables', (done) => {
      let state;
      const engine = new Bpmn.Engine({
        source: factory.resource('issue-19-2.bpmn'),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener = new EventEmitter();

      listener.on('start', () => {
        state = engine.getState();
      });

      listener.once('wait-waitForSignalTask', () => {
        state = engine.getState();
        engine.stop();
      });

      engine.once('end', () => {
        const listener2 = new EventEmitter();
        listener2.once('wait-waitForSignalTask', (task) => {
          task.signal();
        });

        nock('http://example.com')
          .get('/api')
          .reply(200, {
            status: 'OK'
          });

        const engine2 = Bpmn.Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', (def) => {
          expect(def.variables).to.include({
            retry: true,
            errorCode: 'REQ_FAIL',
            requestErrorMessage: 'REQ_FAIL: Error message',
            statusCode: 200,
            body: {
              status: 'OK'
            }
          });
          expect(def.getChildActivityById('terminateEvent').taken).to.be.false();
          expect(def.getChildActivityById('end').taken).to.be.true();
          done();
        });
      });

      nock('http://example.com')
        .get('/api')
        .replyWithError(new Error('REQ_FAIL: Error message'));

      engine.execute({
        listener: listener,
        variables: {
          apiUrl: 'http://example.com/api',
          timeout: 'PT0.1S'
        },
        services: services
      });
    });

    lab.test('takes decision based on error', (done) => {
      let state;
      const engine = new Bpmn.Engine({
        source: factory.resource('issue-19-2.bpmn'),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener = new EventEmitter();

      listener.on('start', () => {
        state = engine.getState();
      });

      listener.once('wait-waitForSignalTask', () => {
        state = engine.getState();
        engine.stop();
      });

      engine.once('end', () => {
        const listener2 = new EventEmitter();
        listener2.once('wait-waitForSignalTask', (task) => {
          task.signal();
        });

        nock('http://example.com')
          .get('/api')
          .replyWithError(new Error('RETRY_FAIL: Error message'));

        const engine2 = Bpmn.Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', (def) => {
          expect(def.variables).to.include({
            retry: true,
            errorCode: 'RETRY_FAIL',
            requestErrorMessage: 'RETRY_FAIL: Error message'
          });
          expect(def.getChildActivityById('terminateEvent').taken).to.be.true();
          expect(def.getChildActivityById('end').taken).to.be.false();
          done();
        });
      });

      nock('http://example.com')
        .get('/api')
        .replyWithError(new Error('REQ_FAIL: Error message'));

      engine.execute({
        listener: listener,
        variables: {
          apiUrl: 'http://example.com/api',
          timeout: 'PT0.1S'
        },
        services: services
      });
    });
  });

  lab.describe('issue 23', () => {
    lab.test('exclusiveGateway in loop should trigger end event', (done) => {
      const definitionXml2 = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
   xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="issue-23" isExecutable="true">
    <startEvent id="start" />
    <task id="task1" />
    <task id="task2">
      <extensionElements>
        <camunda:InputOutput>
          <camunda:outputParameter name="tookDecision">\${variables.decision}</camunda:outputParameter>
        </camunda:InputOutput>
      </extensionElements>
    </task>
    <exclusiveGateway id="decision" default="flow4">
      <extensionElements>
        <camunda:InputOutput>
          <camunda:outputParameter name="decision">\${true}</camunda:outputParameter>
        </camunda:InputOutput>
      </extensionElements>
    </exclusiveGateway>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1" />
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="task2" />
    <sequenceFlow id="flow3" sourceRef="task2" targetRef="decision" />
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="task1" />
    <sequenceFlow id="flow5" sourceRef="decision" targetRef="end">
      <conditionExpression xsi:type="tFormalExpression">\${variables.tookDecision}</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: definitionXml2,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      engine.once('end', (def) => {
        expect(def.getChildActivityById('end').taken).to.be.true();
        done();
      });

      const listener = new EventEmitter();
      let taskCount = 0;
      listener.on('start-task1', (a) => {
        taskCount++;
        if (taskCount > 2) {
          Code.fail(new Error(`Too many <${a.id}> starts`));
        }
      });

      engine.execute({
        listener: listener
      });
    });
  });
});
