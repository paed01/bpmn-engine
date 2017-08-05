'use strict';

const {Engine} = require('../..');
const Environment = require('../../lib/Environment');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');
const nock = require('nock');
const request = require('request');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {after, beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

const bupServiceFn = testHelpers.serviceFn;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('ServiceTask', () => {
  after((done) => {
    testHelpers.serviceFn = bupServiceFn;
    done();
  });

  describe('behaviour', () => {
    it('stores service if extension name', (done) => {
      const source = factory.resource('service-task.bpmn').toString();
      testHelpers.getContext(source, moddleOptions, (cerr, context) => {
        if (cerr) return done(cerr);
        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['service']);
        done();
      });
    });

    it('stores expression service', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, moddleOptions, (cerr, context) => {
        if (cerr) return done(cerr);
        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['service']);
        expect(task.service).to.include({
          value: '${services.get}'
        });
        done();
      });
    });

    it('emits error if service definition is not found', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (cerr, context) => {
        if (cerr) return done(cerr);
        const task = context.getChildActivityById('serviceTask');
        task.activate();
        task.once('error', (err) => {
          expect(err).to.be.an.error(/no service definition found/i);
          done();
        });

        task.run();
      });
    });
  });

  describe('execute()', () => {
    let context;
    beforeEach((done) => {
      const source = factory.resource('service-task.bpmn').toString();
      testHelpers.getContext(source, moddleOptions, (err, result) => {
        if (err) return done(err);
        testHelpers.serviceFn = (message, callback) => {
          callback(null, true);
        };

        const environment = Environment({
          services: {
            postMessage: {
              module: './test/helpers/testHelpers',
              fnName: 'serviceFn'
            }
          }
        });
        context = result.getSubContext(result.id, environment);
        done();
      });
    });

    it('executes service on taken inbound', (done) => {
      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('end', (activityApi, executionContext) => {
        expect(executionContext.getOutput()).to.equal([true]);

        done();
      });

      task.inbound[0].take();
    });

    it('can access and modify variables', (done) => {
      context.environment.addService('postMessage', (message, callback) => {
        message.variables.input = 'wuiiii';
        callback();
      });

      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('end', () => {
        expect(context.environment.variables.input).to.equal('wuiiii');
        done();
      });

      task.inbound[0].take();
    });

    it('error in callback caught by bound error event', (done) => {
      context.environment.addService('postMessage', (message, callback) => {
        callback(new Error('Failed'));
      });

      const task = context.getChildActivityById('serviceTask');
      const boundEvent = context.getChildActivityById('errorEvent');
      boundEvent.activate();
      task.activate();

      boundEvent.once('end', (event) => {
        expect(event.getState().taken).to.be.true();
        done();
      });

      task.inbound[0].take();
    });

    it('times out if bound timeout event if callback is not called within timeout duration', (done) => {
      context.environment.addService('postMessage', () => {});

      const task = context.getChildActivityById('serviceTask');
      const timeoutEvent = context.getChildActivityById('timerEvent');
      const errEvent = context.getChildActivityById('errorEvent');
      timeoutEvent.activate();
      errEvent.activate();
      task.activate();

      timeoutEvent.once('end', (event) => {
        expect(event.getState().taken).to.be.true();
        done();
      });

      task.inbound[0].take();
    });
  });

  describe('IO', () => {
    it('uses input parameters', (done) => {
      nock('http://example.com')
        .defaultReplyHeaders({
          'Content-Type': 'application/json'
        })
        .get('/test')
        .reply(200, {
          data: 4
        });

      const processXml = factory.resource('service-task-io.bpmn').toString();
      testHelpers.getContext(processXml, moddleOptions, (err, result) => {
        if (err) return done(err);
        const environment = Environment({
          services: {
            getRequest: {
              module: 'request',
              fnName: 'get'
            }
          },
          variables: {
            apiPath: 'http://example.com/test'
          }
        });
        const context = result.getSubContext(result.id, environment);

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('start', (activityApi, executionContext) => {
          expect(executionContext.getInput()).to.equal({ uri: 'http://example.com/test', json: true });
        });

        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.include(['statusCode', 'body']);
          expect(output.statusCode).to.equal(200);
          expect(output.body).to.equal({ data: 4});
          done();
        });

        task.inbound[0].take();
      });

    });

    it('returns mapped output', (done) => {
      const processXml = factory.resource('service-task-io-types.bpmn').toString();
      testHelpers.getContext(processXml, moddleOptions, (err, context) => {
        if (err) return done(err);

        context.environment.assignVariables({
          apiPath: 'http://example-2.com',
          input: 2,
        });
        context.environment.addService('get', (arg, next) => {
          next(null, {
            statusCode: 200,
            pathname: '/ignore'
          }, {
            data: arg.input
          });
        });

        const task = context.getChildActivityById('serviceTask');
        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.equal({
            statusCode: 200,
            body: {
              data: 2
            }
          });
          done();
        });

        task.run();
      });
    });
  });

  describe('service expression', () => {
    it('executes function call expression with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService()}" camunda:resultVariable="taskOutput" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, moddleOptions, (err, context) => {
        if (err) return done(err);
        context.environment.addService('getService', () => {
          return (arg, callback) => {
            callback(null, arg.variables.input, 'success');
          };
        });
        context.environment.assignVariables({input: 1});

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.equal([1, 'success']);
          done();
        });

        task.run();
      });
    });

    it('executes expression function call with variable reference argument with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService(variables.input)}" camunda:resultVariable="taskOutput" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, moddleOptions, (err, context) => {
        if (err) return done(err);
        context.environment.addService('getService', (input) => {
          return (executionContext, callback) => {
            callback(null, input);
          };
        });
        context.environment.assignVariables({
          input: 1
        });

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.equal([1]);
          done();
        });

        task.run();
      });
    });

    it('executes expression function call with static value argument with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService(whatever value)}" camunda:resultVariable="taskOutput" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, moddleOptions, (err, context) => {
        if (err) return done(err);
        context.environment.addService('getService', (input) => {
          return (executionContext, callback) => {
            callback(null, input);
          };
        });
        context.environment.assignVariables({
          input: 1
        });

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.equal(['whatever value']);
          done();
        });

        task.run();
      });
    });
  });

  describe('Camunda connector is defined with input/output', () => {
    let context;
    lab.before((done) => {
      testHelpers.getContext(factory.resource('issue-4.bpmn').toString(), {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, result) => {
        if (err) return done(err);
        context = result;
        context.environment.addService('send-email', (emailAddress, callback) => {
          callback(null, 'success');
        });
        context.environment.assignVariables({
          emailAddress: 'lisa@example.com'
        });
        done();
      });
    });

    it('service task has io', (done) => {
      const task = context.getChildActivityById('sendEmail_1');
      expect(task.io, 'task IO').to.exist();
      done();
    });

    it('executes connector-id service', (done) => {
      const task = context.getChildActivityById('sendEmail_1');
      task.once('end', (activityApi, executionContext) => {
        const output = executionContext.getOutput();
        expect(output).to.equal({
          messageId: 'success',
        });
        done();
      });

      task.run();
    });

    it('executes service using defined input', (done) => {
      const task = context.getChildActivityById('sendEmail_1');
      let input, inputArg;

      context.environment.addService('send-email', (emailAddress, callback) => {
        inputArg = emailAddress;
        callback(null, 'success');
      });

      task.once('start', (activityApi, executionContext) => {
        input = executionContext.getInput();
      });

      task.once('end', (activityApi, executionContext) => {
        const output = executionContext.getOutput();
        expect(input).to.equal({
          emailAddress: 'lisa@example.com'
        });
        expect(inputArg).to.equal('lisa@example.com');
        expect(output).to.equal({
          messageId: 'success',
        });
        done();
      });

      task.run();
    });

    it('returns defined output', (done) => {
      const task = context.getChildActivityById('sendEmail_1');

      context.environment.addService('send-email', (emailAddress, callback) => {
        callback(null, 10);
      });

      task.once('end', (activityApi, executionContext) => {
        const output = executionContext.getOutput();
        expect(output).to.equal({
          messageId: 10,
        });
        done();
      });

      task.run();
    });

    it('service expects input options', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Call api">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>get</camunda:connectorId>
              </camunda:connector>
              <camunda:inputOutput>
                <camunda:inputParameter name="uri">\${variables.api}/v1/data</camunda:inputParameter>
                <camunda:inputParameter name="json">\${true}</camunda:inputParameter>
                <camunda:inputParameter name="headers">
                  <camunda:map>
                    <camunda:entry key="User-Agent">curl</camunda:entry>
                    <camunda:entry key="Accept">application/json</camunda:entry>
                  </camunda:map>
                </camunda:inputParameter>
                <camunda:outputParameter name="statusCode">\${result[0].statusCode}</camunda:outputParameter>
                <camunda:outputParameter name="body">\${result[1]}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      nock('http://example.com', {
        reqheaders: {
          'User-Agent': 'curl',
          Accept: 'application/json'
        }})
        .defaultReplyHeaders({
          'Content-Type': 'application/json'
        })
        .get('/v1/data')
        .reply(200, {
          data: 4
        });

      testHelpers.getContext(processXml, moddleOptions, (err, processContext) => {
        if (err) return done(err);
        processContext.environment.addService('get', {
          module: 'request',
          fnName: 'get'
        });
        processContext.environment.assignVariables({
          api: 'http://example.com'
        });

        const task = processContext.getChildActivityById('serviceTask');

        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.equal({
            statusCode: 200,
            body: {data: 4}
          });
          done();
        });

        task.run();
      });
    });

    it('service function address other service function', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Call api">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>myFunc</camunda:connectorId>
              </camunda:connector>
              <camunda:inputOutput>
                <camunda:inputParameter name="variables">\${variables}</camunda:inputParameter>
                <camunda:inputParameter name="services">\${services}</camunda:inputParameter>
                <camunda:outputParameter name="message">\${result[0]}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, moddleOptions, (err, processContext) => {
        if (err) return done(err);
        processContext.environment.addService('appendPath', (uri) => {
          return `${uri}/v3/data`;
        });
        processContext.environment.addService('myFunc', (message, callback) => {
          const apiWithPath = message.services.appendPath(message.variables.api);
          callback(null, `successfully executed with ${apiWithPath}`);
        });
        processContext.environment.assignVariables({
          api: 'http://example.com'
        });

        const task = processContext.getChildActivityById('serviceTask');

        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.equal({
            message: 'successfully executed with http://example.com/v3/data'
          });
          done();
        });

        task.run();
      });
    });
  });

  describe('engine', () => {
    it('multiple inbound completes process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="testProcess" isExecutable="true">
          <startEvent id="start" />
          <serviceTask id="task" name="Get" camunda:expression="\${services.get(variables.defaultTaken)}" camunda:resultVariable="taskOutput" />
          <exclusiveGateway id="decision" default="flow3">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="defaultTaken">\${true}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </exclusiveGateway>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
          <sequenceFlow id="flow2" sourceRef="task" targetRef="decision" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="task" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression">\${variables.defaultTaken}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activity) => {
        startCount++;
        if (startCount > 2) {
          fail(`<${activity.id}> Too many starts`);
        }
      });
      let endEventCount = 0;
      listener.on('start-end', () => {
        endEventCount++;
      });

      engine.execute({
        listener,
        services: {
          get: (defaultTaken) => {
            return function(context, callback) {
              callback(null, `successfully executed ${defaultTaken === true ? 'twice' : 'once'}`);
            };
          }
        },
        variables: {
          api: 'http://example.com'
        }
      });
      engine.once('end', (execution) => {
        expect(startCount, 'task starts').to.equal(2);
        expect(endEventCount, 'end event').to.equal(1);
        expect(execution.getOutput()).to.equal({
          defaultTaken: true,
          taskOutput: ['successfully executed twice']
        });
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });

  describe('loop', () => {
    describe('sequential', () => {
      let context;
      beforeEach((done) => {
        getLoopContext(true, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      it('emits start with task id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        nock('http://example.com')
          .get('/api/pal?version=0')
          .delay(50)
          .reply(200, {})
          .get('/api/franz?version=1')
          .delay(30)
          .reply(200, {})
          .get('/api/immanuel?version=2')
          .reply(409, {});

        const starts = [];
        task.on('start', (activity) => {
          starts.push(activity.id);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts).to.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      it('emits end with output', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const input = executionContext.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .reply(input.version < 2 ? 200 : 409, {});
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          const output = executionContext.getOutput();
          expect(output.loopResult).to.equal([{
            statusCode: 200,
            body: {}
          }, {
            statusCode: 200,
            body: {}
          }, {
            statusCode: 409,
            body: {}
          }]);
          done();
        });

        task.run();
      });

      it('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const input = executionContext.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .delay(50 - input.version * 10)
            .reply(input.version < 2 ? 200 : 409, {
              idx: input.version
            });
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(executionContext.getOutput().loopResult).to.equal([{
            statusCode: 200,
            body: {
              idx: 0
            }
          }, {
            statusCode: 200,
            body: {
              idx: 1
            }
          }, {
            statusCode: 409,
            body: {
              idx: 2
            }
          }]);
          done();
        });

        task.run();
      });

    });

    describe('parallell', () => {
      let context;
      beforeEach((done) => {
        getLoopContext(false, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      it('emits start with different ids', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        nock('http://example.com')
          .get('/api/pal?version=0')
          .delay(50)
          .reply(200, {})
          .get('/api/franz?version=1')
          .delay(30)
          .reply(200, {})
          .get('/api/immanuel?version=2')
          .reply(409, {});

        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      it('returns output in sequence', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const input = executionContext.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .delay(50 - input.version * 10)
            .reply(input.version < 2 ? 200 : 409, {
              idx: input.version
            });
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(executionContext.getOutput().loopResult).to.equal([{
            statusCode: 200,
            body: {
              idx: 0
            }
          }, {
            statusCode: 200,
            body: {
              idx: 1
            }
          }, {
            statusCode: 409,
            body: {
              idx: 2
            }
          }]);
          done();
        });

        task.run();
      });

      it('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const input = executionContext.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .delay(50 - input.version * 10)
            .reply(input.version < 2 ? 200 : 409, {
              idx: input.version
            });
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(executionContext.getOutput().loopResult).to.equal([{
            statusCode: 200,
            body: {
              idx: 0
            }
          }, {
            statusCode: 200,
            body: {
              idx: 1
            }
          }, {
            statusCode: 409,
            body: {
              idx: 2
            }
          }]);
          done();
        });

        task.run();
      });
    });
  });

});

function getLoopContext(isSequential, callback) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="parallellLoopProcess" isExecutable="true">
      <serviceTask id="task">
        <multiInstanceLoopCharacteristics isSequential="${isSequential}" camunda:collection="\${variables.paths}">
          <loopCardinality>5</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="version">\${index}</camunda:inputParameter>
            <camunda:inputParameter name="path">\${item}</camunda:inputParameter>
            <camunda:outputParameter name="loopResult">\${result}</camunda:outputParameter>
          </camunda:inputOutput>
          <camunda:connector>
            <camunda:inputOutput>
              <camunda:inputParameter name="reqOptions">
                <camunda:map>
                  <camunda:entry key="uri">http://example.com/api\${path}?version=\${version}</camunda:entry>
                  <camunda:entry key="json">\${true}</camunda:entry>
                </camunda:map>
              </camunda:inputParameter>
              <camunda:outputParameter name="statusCode">\${result[0].statusCode}</camunda:outputParameter>
              <camunda:outputParameter name="body" />
            </camunda:inputOutput>
            <camunda:connectorId>get</camunda:connectorId>
          </camunda:connector>
        </extensionElements>
      </serviceTask>
    </process>
  </definitions>`;
  testHelpers.getContext(source, moddleOptions, (err, context) => {
    if (err) return callback(err);
    context.environment.assignVariables({
      paths: ['/pal', '/franz', '/immanuel']
    });
    context.environment.services.get = request.get;
    callback(null, context);
  });
}
