'use strict';

const {Engine} = require('../');
const {EventEmitter} = require('events');
const Lab = require('lab');
const nock = require('nock');
const testHelpers = require('./helpers/testHelpers');
const factory = require('./helpers/factory');

const lab = exports.lab = Lab.script();
const {before, describe, it} = lab;
const {expect, fail} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('issues', () => {
  describe('issue #5', () => {
    it('solution', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="Task_15g4wm5" name="Dummy Task">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="service" value="dummy" />
              </camunda:properties>
              <camunda:inputOutput>
                <camunda:inputParameter name="templateId">template_1234</camunda:inputParameter>
                <camunda:inputParameter name="templateArgs">
                  <camunda:map>
                    <camunda:entry key="url"><![CDATA[\${services.getUrl('task1')}]]></camunda:entry>
                  </camunda:map>
                </camunda:inputParameter>
                <camunda:outputParameter name="serviceResult">\${result}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;
      const engine = new Engine({
        source,
        moddleOptions
      });

      engine.execute({
        services: {
          dummy: (executionContext, serviceCallback) => {
            serviceCallback(null, 'dummy');
          },
          getUrl: (path) => {
            return `http://example.com/${path}`;
          }
        },
        variables: {
          emailAddress: 'lisa@example.com'
        }
      }, (err) => {
        if (err) return done(err);
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput().serviceResult).to.equal(['dummy']);
        done();
      });
    });
  });

  describe('issue #7', () => {
    it('solution', (done) => {
      const source = factory.resource('issue-7.bpmn');
      const engine = new Engine({
        source,
        moddleOptions
      });

      engine.execute({
        services: {
          myCustomService: (executionContext, serviceCallback) => {
            serviceCallback(null, 'success');
          }
        }
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput().taskInput.Task_0kxsx8j).to.include(['success']);
        done();
      });
    });
  });

  describe('issue 19 - save state', () => {

    it('make sure there is something to save on listener start events', (done) => {
      const messages = [];
      testHelpers.serviceLog = (message) => {
        messages.push(message);
      };
      testHelpers.serviceTimeout = (cb, time) => {
        setTimeout(cb, time);
      };

      let state;
      const engine = new Engine({
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
        const engine2 = Engine.resume(state, {
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
        listener,
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

  describe('issue-19 - on error', () => {
    let services;
    const source = factory.resource('issue-19-2.bpmn');
    before((done) => {
      testHelpers.statusCodeOk = (statusCode) => {
        return statusCode === 200;
      };
      testHelpers.extractErrorCode = (errorMessage) => {
        console.log('LKAJSDLASKLJDJKLASD', errorMessage)
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

    it('completes when returning to request after resume', (done) => {
      testHelpers.statusCodeOk = (statusCode) => {
        return statusCode === 200;
      };

      let state;
      const engine = new Engine({
        source,
        moddleOptions
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
        listener2.once('wait-waitForSignalTask', (activityApi) => {
          activityApi.signal();
        });

        nock('http://example.com')
          .get('/api')
          .reply(200, {
            status: 'OK'
          });

        const engine2 = Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', (execution) => {
          expect(execution.getOutput()).to.include({
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
        listener,
        services,
        variables: {
          apiUrl: 'http://example.com/api',
          timeout: 'PT0.1S'
        }
      });

    });

    it('caught error is saved to variables', (done) => {
      let state;
      const engine = new Engine({
        source,
        moddleOptions
      });
      const listener = new EventEmitter();

      listener.on('start', () => {
        state = engine.getState();
      });

      listener.once('wait-waitForSignalTask', () => {
        state = engine.getState();
        engine.stop();
      });

      engine.once('end', (execution) => {
        const listener2 = new EventEmitter();
        listener2.once('wait-waitForSignalTask', (task) => {
          task.signal();
        });

        console.log(JSON.stringify(execution.getOutput(), null, 2))
        console.log('STOPPED', JSON.stringify(state.definitions[0].processes, null, 2))

        nock('http://example.com')
          .get('/api')
          .reply(200, {
            status: 'OK'
          });

        const engine2 = Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', (execution) => {
          expect(execution.getOutput()).to.include({
            retry: true,
            errorCode: 'REQ_FAIL',
            requestErrorMessage: 'REQ_FAIL: Error message',
            statusCode: 200,
            body: {
              status: 'OK'
            }
          });
          expect(execution.getChildActivityById('terminateEvent').taken).to.be.false();
          expect(execution.getChildActivityById('end').taken).to.be.true();
          done();
        });
      });

      nock('http://example.com')
        .get('/api')
        .replyWithError(new Error('REQ_FAIL: Error message'));

      engine.execute({
        listener,
        variables: {
          apiUrl: 'http://example.com/api',
          timeout: 'PT0.1S'
        },
        services: services
      });
    });

    it('takes decision based on error', (done) => {
      let state;
      const engine = new Engine({
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

        const engine2 = Engine.resume(state, {
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

  describe('issue 23', () => {
    it('exclusiveGateway in loop should trigger end event', (done) => {
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

      const engine = new Engine({
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
          fail(new Error(`Too many <${a.id}> starts`));
        }
      });

      engine.execute({
        listener: listener
      });
    });
  });
});
