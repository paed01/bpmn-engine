'use strict';

const factory = require('./helpers/factory');
const Lab = require('lab');
const nock = require('nock');
const testHelpers = require('./helpers/testHelpers');
const {Engine} = require('../');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect, fail} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('Resume execution', () => {

  it('starts with stopped task', (done) => {
    const source = factory.userTask();
    const engine = new Engine({
      source,
      name: 'new'
    });
    const listener1 = new EventEmitter();

    let state;
    listener1.on('wait-userTask', () => {
      state = engine.getState();
      engine.stop();
    });

    engine.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine);

      state.definitions[0].environment.variables.input = 'resumed';

      const listener2 = new EventEmitter();

      listener2.once('start-theStart', (activity) => {
        fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      const resumedEngine = Engine.resume(testHelpers.readFromDb(state), {
        listener: listener2
      }, (err) => {
        if (err) return done(err);
      });

      resumedEngine.once('end', () => {
        done();
      });
    });

    engine.execute({
      listener: listener1,
      variables: {
        input: 'start'
      }
    });
  });

  it('resumes stopped subprocess', (done) => {
    const engine1 = new Engine({
      source: factory.resource('mother-of-all.bpmn'),
      name: 'stopMe'
    });
    const listener1 = new EventEmitter();

    listener1.on('wait-userTask1', (task) => {
      task.signal('init');
    });

    let state;
    listener1.once('wait-subUserTask1', () => {
      state = engine1.getState();
      engine1.stop();
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      const listener2 = new EventEmitter();

      listener2.on('wait-userTask1', (task) => {
        task.signal('resumed');
      });

      listener2.on('start-theStart', (activity) => {
        fail(`<${activity.id}> should not have been started`);
      });

      listener2.on('end-subUserTaskTimer', (activity) => {
        fail(`<${activity.id}> should not have been started`);
      });

      listener2.on('wait-subUserTask1', (task) => {
        task.signal('Continue');
      });

      Engine.resume(testHelpers.readFromDb(state), {
        listener: listener2
      }, (err, resumedDefinition) => {
        if (err) return done(err);
        expect(resumedDefinition.getOutput().taskInput.userTask1).to.equal('resumed');
        done();
      });
    });

    engine1.execute({
      listener: listener1,
      services: {
        runService: {
          module: './test/helpers/testHelpers',
          fnName: 'serviceFn',
          type: 'require'
        }
      },
      variables: {
        input: null
      }
    });
  });

  it('resumed interrupting timeout event resumes with remaining ms', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="interruptedProcess" isExecutable="true">
        <userTask id="dontWaitForMe" />
        <boundaryEvent id="timeoutEvent" attachedToRef="dontWaitForMe">
          <timerEventDefinition>
            <timeDuration xsi:type="tFormalExpression">PT0.1S</timeDuration>
          </timerEventDefinition>
        </boundaryEvent>
      </process>
    </definitions>`;
    const engine = new Engine({
      source,
      name: 'stopMe'
    });
    const listener = new EventEmitter();

    let state;
    listener.once('wait-dontWaitForMe', () => {
      setTimeout(() => {
        state = engine.getState();
        engine.stop();
      }, 25);
    });

    engine.once('end', () => {
      const timeout = state.definitions[0].processes.interruptedProcess.children.find(c => c.id === 'timeoutEvent').timeout;

      expect(timeout).to.be.between(0, 99);

      const startedAt = new Date();
      Engine.resume(testHelpers.readFromDb(state), (err) => {
        if (err) return done(err);
        expect((new Date()) - startedAt, `resumed timout is ${timeout}ms`).to.not.be.above(102); // Close to 100
        done();
      });
    });

    engine.execute({
      listener
    });
  });

  it('resumes bound error event', (done) => {
    const source = `
    <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="interruptedProcess" isExecutable="true">
        <startEvent id="start" />
        <boundaryEvent id="errorEvent" attachedToRef="scriptTask">
          <errorEventDefinition />
        </boundaryEvent>
        <scriptTask id="scriptTask" name="Check input" scriptFormat="JavaScript">
          <script><![CDATA[
            if (!variables.input) {
              next(new Error("Input is missing"));
            } else if (variables.input === 2) {
            } else {
              next();
            }]]>
          </script>
        </scriptTask>
        <boundaryEvent id="timerEvent" attachedToRef="scriptTask">
          <timerEventDefinition>
            <timeDuration xsi:type="tFormalExpression">PT1S</timeDuration>
          </timerEventDefinition>
        </boundaryEvent>
        <endEvent id="endInError" />
        <endEvent id="timedEndEvent">
          <terminateEventDefinition />
        </endEvent>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="scriptTask" />
        <sequenceFlow id="flow2" sourceRef="timerEvent" targetRef="timedEndEvent" />
        <sequenceFlow id="flow3" sourceRef="errorEvent" targetRef="endInError" />
        <sequenceFlow id="flow4" sourceRef="scriptTask" targetRef="end" />
      </process>
    </definitions>`;

    const engine1 = new Engine({
      source,
      name: 'stopMe'
    });
    const listener1 = new EventEmitter();

    let state;
    listener1.once('start-timerEvent', () => {
      state = engine1.getState();
      engine1.stop();
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      state.definitions[0].environment.variables.input = undefined;

      const listener2 = new EventEmitter();

      listener2.on('end-scriptTask', (activity) => {
        fail(`<${activity.id}> should not have ended`);
      });
      listener2.on('start-timedEndEvent', (activity) => {
        fail(`<${activity.id}> should not have been taken`);
      });

      Engine.resume(testHelpers.readFromDb(state), {
        listener: listener2
      }, done);
    });

    engine1.execute({
      listener: listener1,
      variables: {
        input: 2
      }
    }, (err) => {
      if (err) return done(err);
    });
  });

  it('with required module in saved state variables', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
      <startEvent id="theStart" />
      <userTask id="userTask" />
      <scriptTask id="scriptTask" scriptFormat="Javascript">
        <script>
          <![CDATA[
            services.request.get('http://example.com/test', (err, resp, body) => {
              if (err) return next(err);
              next(err, body);
            })
          ]]>
        </script>
      </scriptTask>
      <endEvent id="theEnd" />
      <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
      <sequenceFlow id="flow2" sourceRef="userTask" targetRef="scriptTask" />
      <sequenceFlow id="flow3" sourceRef="scriptTask" targetRef="theEnd" />
      </process>
    </definitions>`;

    nock('http://example.com')
      .defaultReplyHeaders({
        'Content-Type': 'application/json'
      })
      .get('/test')
      .reply(200, {
        data: 2
      });

    const engine1 = new Engine({
      source
    });
    const listener1 = new EventEmitter();
    const options = {
      listener: listener1,
      services: {
        request: {
          module: 'request'
        }
      }
    };

    let state;
    listener1.once('wait-userTask', () => {
      state = engine1.getState();
      engine1.stop();
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      const listener2 = new EventEmitter();
      listener2.once('wait-userTask', (task) => {
        task.signal();
      });
      Engine.resume(testHelpers.readFromDb(state), {
        listener: listener2
      }, done);
    });

    engine1.execute(options, (err) => {
      if (err) return done(err);
    });
  });

  it('with require in saved state variables', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <userTask id="userTask" />
        <scriptTask id="scriptTask" scriptFormat="Javascript">
          <script>
            <![CDATA[
              const require = services.require;
              const request = require('request');

              const self = this;

              request.get('http://example.com/test', (err, resp, body) => {
                if (err) return next(err);
                self.variables.data = body.data;
                next();
              })
            ]]>
          </script>
        </scriptTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
        <sequenceFlow id="flow2" sourceRef="userTask" targetRef="scriptTask" />
        <sequenceFlow id="flow3" sourceRef="scriptTask" targetRef="theEnd" />
      </process>
    </definitions>`;

    nock('http://example.com')
      .defaultReplyHeaders({
        'Content-Type': 'application/json'
      })
      .get('/test')
      .reply(200, {
        data: 3
      });

    const engine1 = new Engine({
      source: source
    });
    const listener1 = new EventEmitter();
    const options = {
      listener: listener1,
      services: {
        require: {
          module: 'require',
          type: 'global'
        }
      }
    };

    let state;
    listener1.once('wait-userTask', () => {
      state = engine1.getState();
      engine1.stop();
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      const listener2 = new EventEmitter();
      listener2.once('wait-userTask', (task) => {
        task.signal();
      });
      Engine.resume(testHelpers.readFromDb(state), {
        listener: listener2
      }, done);
    });

    engine1.execute(options, (err) => {
      if (err) return done(err);
    });
  });

  it('resumes with moddle options', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <userTask id="userTask" />
        <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" camunda:resultVariable="output" />
        <sequenceFlow id="flow1" sourceRef="userTask" targetRef="serviceTask" />
      </process>
    </definitions>`;

    testHelpers.resumeFn = (executionContext, callback) => {
      callback(null, {
        statusCode: 200,
        body: {
          input: 1
        }
      });
    };

    const engine1 = new Engine({
      source,
      moddleOptions
    });
    const listener1 = new EventEmitter();
    const options = {
      listener: listener1,
      services: {
        get: {
          module: './test/helpers/testHelpers',
          type: 'require',
          fnName: 'resumeFn'
        }
      }
    };

    let state;
    listener1.once('wait-userTask', () => {
      state = engine1.getState();
      engine1.stop();
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      const listener2 = new EventEmitter();
      listener2.once('wait-userTask', (task) => {
        task.signal();
      });

      Engine.resume(testHelpers.readFromDb(state), {
        listener: listener2
      }, (err, resumedDefinition) => {
        if (err) return done(err);
        expect(resumedDefinition.getOutput().output[0]).to.include(['statusCode', 'body']);
        done();
      });
    });

    engine1.execute(options);
  });

  lab.describe('with form', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start">
          <extensionElements>
            <camunda:formData>
              <camunda:formField id="formfield1" label="FormField1" type="string" />
              <camunda:formField id="formfield2" type="long" />
            </camunda:formData>
          </extensionElements>
          </startEvent>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
      </process>
    </definitions>`;

    let state;
    it('given a StartEvent with form and a saved state', (done) => {
      const listener = new EventEmitter();

      listener.once('wait', () => {
        state = engine.getState();
        engine.stop();
      });

      const engine = new Engine({
        source,
        moddleOptions
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        listener
      });
    });

    it('completes when resumed and signaled', (done) => {
      const listener = new EventEmitter();

      listener.once('wait', (activityApi) => {
        activityApi.signal({
          formfield1: 'a',
          formfield2: 1
        });
      });

      const engine = Engine.resume(state, {
        listener: listener
      });

      engine.once('end', () => {
        done();
      });
    });
  });
});
