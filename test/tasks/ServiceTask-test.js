'use strict';

const nock = require('nock');
const request = require('request');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

const bupServiceFn = testHelpers.serviceFn;

describe('ServiceTask', () => {
  after((done) => {
    testHelpers.serviceFn = bupServiceFn;
    done();
  });

  describe('behaviour', () => {
    it('implementation expression is recognized', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" implementation="\${services.get}" />
        </process>
      </definitions>`;

      const context = await testHelpers.context(source);

      const task = context.getChildActivityById('serviceTask');
      expect(task).to.have.property('service');
      expect(task.service.services[0]).to.include({
        implementation: '${services.get}'
      });
    });

    it('no service on execution throws', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true" implementation="">
          <serviceTask id="task" name="Get" />
        </process>
      </definitions>`;

      const context = await testHelpers.context(source, {disableDummyService: true});
      const task = context.getChildActivityById('task');
      const api = task.activate();

      try {
        api.run();
      } catch (e) {
        var err = e; // eslint-disable-line
      }

      expect(err).to.be.an('error').and.match(/no service definition found/);
    });
  });

  describe('execute()', () => {
    let context;
    beforeEach(async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" />
          <serviceTask id="serviceTask" name="Get" implementation="\${services.postMessage}" />
          <boundaryEvent id="errorEvent" attachedToRef="serviceTask">
            <errorEventDefinition />
          </boundaryEvent>
          <boundaryEvent id="timerEvent" attachedToRef="serviceTask">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT0.05S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
          <sequenceFlow id="flow1" sourceRef="start" targetRef="serviceTask" />
        </process>
      </definitions>`;

      context = await testHelpers.context(source);
      testHelpers.serviceFn = (message, callback) => {
        callback(null, true);
      };

      context.environment.addService('postMessage', {
        module: './test/helpers/testHelpers',
        fnName: 'serviceFn'
      });
    });

    it('executes dummy function if service is undefined', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (cerr, context2) => {
        if (cerr) return done(cerr);
        const task = context2.getChildActivityById('serviceTask');
        task.activate();
        task.once('end', () => done());
        task.run();
      });
    });

    it('executes service on taken inbound', (done) => {
      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('end', (activityApi, executionContext) => {
        expect(executionContext.getOutput()).to.eql([true]);
        done();
      });

      task.inbound[0].take();
    });

    it('is called with input context', (done) => {
      context.environment.addService('postMessage', (message, callback) => {
        expect(message).to.have.property('output');
        expect(message).to.have.property('variables');
        expect(message).to.have.property('services');
        callback();
      });

      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('end', () => done());

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
        expect(event.getState().taken).to.be.true;
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
        expect(event.getState().taken).to.be.true;
        done();
      });

      task.inbound[0].take();
    });

    describe('resume()', () => {
      it('sets resume flag on service function argument', (done) => {
        context.environment.addService('postMessage', (arg, next) => {
          next();
        });

        const task = context.getChildActivityById('serviceTask');

        task.once('start', (activityApi, executionContext) => {
          const api = activityApi.getApi(executionContext);
          const state = api.getState();
          api.stop();

          const resumeContext = context.clone();
          resumeContext.environment.addService('postMessage', (arg, next) => {
            expect(arg.resumed, 'service resumed').to.be.true;
            next();
          });
          const resumeTask = resumeContext.getChildActivityById('serviceTask');
          resumeTask.on('end', () => {
            done();
          });

          resumeTask.activate(state).resume();
        });

        task.activate().run();
      });
    });
  });

  describe('implementation expression', () => {
    it('executes expression function call with variable reference argument with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" implementation="\${services.getService(variables.input)}" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, (err, context) => {
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
          expect(output).to.eql([1]);
          done();
        });

        task.run();
      });
    });

    it('executes expression function call with static value argument with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" implementation="\${services.getService('whatever value')}" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, (err, context) => {
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
          expect(output).to.eql(['whatever value']);
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
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="testProcess" isExecutable="true">
          <startEvent id="start" />
          <serviceTask id="task" name="Get" implementation="\${services.get(output.taskInput.decision.defaultTaken)}" />
          <exclusiveGateway id="decision" default="flow3" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
          <sequenceFlow id="flow2" sourceRef="task" targetRef="decision" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="task" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression">\${output.taskInput.decision.defaultTaken}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activity) => {
        startCount++;
        if (startCount > 2) {
          expect.fail(`<${activity.id}> Too many starts`);
        }
      });

      listener.once('start-decision', (activityApi) => {
        activityApi.signal({defaultTaken: true});
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
        expect(execution.getOutput().taskInput).to.eql({
          decision: {
            defaultTaken: true
          },
          task: ['successfully executed twice']
        });
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });

  describe('extensions', () => {
    it('supports saving result in variable', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="testProcess" isExecutable="true">
          <serviceTask id="task" name="Get" implementation="\${services.save}" js:result="result" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        extensions: {
          js: require('../resources/JsExtension')
        }
      });

      engine.execute({
        services: {
          save: (inputContext, callback) => {
            callback(null, 1);
          }
        }
      });
      engine.once('end', (execution) => {
        expect(execution.getOutput()).to.eql({
          result: [1]
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

          expect(starts).to.eql(['task', 'task', 'task']);
          expect(nock.isDone()).to.be.true;
          done();
        });

        task.run();
      });

      it('emits end when completed', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const {index, variables} = executionContext.getInputContext();
          const pathname = variables.paths[index];

          nock('http://example.com')
            .get(`/api${pathname}?version=${index}`)
            .reply(index < 2 ? 200 : 409, {});
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          done();
        });

        task.run();
      });

      it('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const {index, variables} = executionContext.getInputContext();
          const pathname = variables.paths[index];

          nock('http://example.com')
            .get(`/api${pathname}?version=${index}`)
            .delay(50 - index * 10)
            .reply(index < 2 ? 200 : 409, {
              idx: index
            });
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          expect(executionContext.getOutput()).to.eql([
            [{
              statusCode: 200,
              body: {
                idx: 0
              }
            }],
            [{
              statusCode: 200,
              body: {
                idx: 1
              }
            }],
            [{
              statusCode: 409,
              body: {
                idx: 2
              }
            }]
          ]);
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
          .delay(20)
          .reply(200, {})
          .get('/api/franz?version=1')
          .delay(10)
          .reply(200, {})
          .get('/api/immanuel?version=2')
          .reply(409, {});

        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(starts.includes(task.id), 'unique task id').to.be.false;
          done();
        });

        task.run();
      });

      it('returns output in sequence', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const {index, variables} = executionContext.getInputContext();
          const pathname = variables.paths[index];
          nock('http://example.com')
            .get(`/api${pathname}?version=${index}`)
            .delay(50 - index * 10)
            .reply(index < 2 ? 200 : 409, {
              idx: index
            });
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(executionContext.getOutput()).to.eql([
            [{
              statusCode: 200,
              body: {
                idx: 0
              }
            }],
            [{
              statusCode: 200,
              body: {
                idx: 1
              }
            }],
            [{
              statusCode: 409,
              body: {
                idx: 2
              }
            }]
          ]);
          done();
        });

        task.run();
      });

      it('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, executionContext) => {
          const {index, variables} = executionContext.getInputContext();
          const pathname = variables.paths[index];

          nock('http://example.com')
            .get(`/api${pathname}?version=${index}`)
            .delay(50 - index * 10)
            .reply(index < 2 ? 200 : 409, {
              idx: index
            });
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(executionContext.getOutput()).to.eql([
            [{
              statusCode: 200,
              body: {
                idx: 0
              }
            }],
            [{
              statusCode: 200,
              body: {
                idx: 1
              }
            }],
            [{
              statusCode: 409,
              body: {
                idx: 2
              }
            }]
          ]);
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
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="parallellLoopProcess" isExecutable="true">
      <serviceTask id="task" implementation="\${services.get()}">
        <multiInstanceLoopCharacteristics isSequential="${isSequential}">
          <loopCardinality>\${variables.paths.length}</loopCardinality>
        </multiInstanceLoopCharacteristics>
      </serviceTask>
    </process>
  </definitions>`;

  testHelpers.getContext(source, (err, context) => {
    if (err) return callback(err);
    context.environment.set('paths', ['/pal', '/franz', '/immanuel']);
    context.environment.addService('get', (inputContext) => {
      return (arg, next) => {
        const {variables, index} = inputContext;
        const url = `http://example.com/api${variables.paths[index]}?version=${index}`;
        request.get({url, json: true}, (getErr, {statusCode}, body) => {
          next(getErr, {statusCode, body});
        });
      };
    });
    callback(null, context);
  });
}
