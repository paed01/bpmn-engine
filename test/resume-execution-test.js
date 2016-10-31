'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');
const nock = require('nock');
const testHelpers = require('./helpers/testHelpers');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const Bpmn = require('../');

lab.experiment('Resume execution', () => {

  lab.test('starts with stopped task', (done) => {
    const processXml = factory.userTask();
    const engine = new Bpmn.Engine({
      source: processXml,
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

      state.processes.theProcess.variables.input = 'resumed';

      const listener2 = new EventEmitter();

      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      engine.once('end', () => {
        done();
      });

      engine.resume(readFromDb(state), {
        listener: listener2
      }, (err) => {
        if (err) return done(err);
      });
    });

    engine.execute({
      listener: listener1,
      variables: {
        input: 'start'
      }
    }, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumes stopped process even if engine is loaded with different process/version', (done) => {
    const processXml = factory.userTask();
    const engine1 = new Bpmn.Engine({
      source: processXml,
      name: 'stopMe'
    });
    const listener1 = new EventEmitter();

    let state;
    listener1.once('wait-userTask', () => {
      state = engine1.getState();
      engine1.stop();
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      const listener2 = new EventEmitter();
      const engine2 = new Bpmn.Engine({
        source: factory.valid(),
        name: 'resumeMe'
      });
      listener2.once('start-theStart', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.once('wait-userTask', (task) => {
        task.signal('Continue');
      });

      engine2.once('end', () => {
        done();
      });

      engine2.resume(readFromDb(state), {
        listener: listener2
      }, (err) => {
        if (err) return done(err);
      });
    });

    engine1.execute({
      listener: listener1,
      variables: {
        input: null
      }
    }, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumes stopped subprocess', (done) => {
    const engine1 = new Bpmn.Engine({
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
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.on('end-subUserTaskTimer', (activity) => {
        Code.fail(`<${activity.id}> should not have been started`);
      });

      listener2.on('wait-subUserTask1', (task) => {
        task.signal('Continue');
      });

      const engine2 = new Bpmn.Engine({
        source: state.source,
        name: 'resumeMe'
      });
      engine2.resume(readFromDb(state), {
        listener: listener2
      }, (err, resumedInstance) => {
        if (err) return done(err);

        resumedInstance.once('end', () => {
          expect(resumedInstance.variables.taskInput.userTask1).to.equal('resumed');
          done();
        });
      });
    });

    engine1.execute({
      listener: listener1,
      variables: {
        input: null
      }
    }, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumed interrupting timeout event resumes with remaining ms', (done) => {
    const processXml = `
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
</definitions>
    `;
    const engine1 = new Bpmn.Engine({
      source: processXml,
      name: 'stopMe'
    });
    const listener1 = new EventEmitter();

    let state;
    listener1.once('wait-dontWaitForMe', () => {
      setTimeout(() => {
        state = engine1.getState();
        engine1.stop();
      }, 10);
    });

    engine1.once('end', () => {
      const timeout = state.processes.interruptedProcess.children.find(c => c.id === 'timeoutEvent').timeout;
      expect(timeout).to.be.between(0, 99);

      const engine2 = new Bpmn.Engine({
        source: state.source,
        name: 'resumeMe'
      });
      engine2.resume(readFromDb(state), (err, resumedInstance) => {
        const startedAt = new Date();
        if (err) return done(err);

        resumedInstance.once('end', () => {
          expect((new Date()) - startedAt, `resumed timout is ${timeout}ms`).to.be.below(100);
          done();
        });
      });
    });

    engine1.execute({
      listener: listener1
    }, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('resumes bound error event', (done) => {
    const processXml = `
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
}]]></script>
    </scriptTask>
    <boundaryEvent id="timerEvent" attachedToRef="scriptTask">
      <timerEventDefinition>
        <timeDuration xsi:type="tFormalExpression">PT1S</timeDuration>
      </timerEventDefinition>
    </boundaryEvent>
    <endEvent id="endInError">
      <errorEventDefinition />
    </endEvent>
    <endEvent id="timedEndEvent">
      <terminateEventDefinition />
    </endEvent>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="scriptTask" />
    <sequenceFlow id="flow2" sourceRef="timerEvent" targetRef="timedEndEvent" />
    <sequenceFlow id="flow3" sourceRef="errorEvent" targetRef="endInError" />
    <sequenceFlow id="flow4" sourceRef="scriptTask" targetRef="end" />
  </process>
</definitions>
    `;
    const engine1 = new Bpmn.Engine({
      source: processXml,
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

      delete state.processes.interruptedProcess.variables.input;

      const engine2 = new Bpmn.Engine({
        source: state.source,
        name: 'resumeMe'
      });

      const listener2 = new EventEmitter();

      listener2.on('end-scriptTask', (activity) => {
        Code.fail(`<${activity.id}> should not have ended`);
      });
      listener2.on('start-timedEndEvent', (activity) => {
        Code.fail(`<${activity.id}> should not have been taken`);
      });

      engine2.resume(readFromDb(state), {
        listener: listener2
      }, (err, resumedInstance) => {
        if (err) return done(err);
        resumedInstance.once('end', () => {
          expect(resumedInstance.getChildActivityById('errorEvent').taken).to.be.true();
          done();
        });
      });
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

  lab.test('with required module in saved state variables', (done) => {
    const processXml = `
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

    const engine1 = new Bpmn.Engine({
      source: processXml
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

      const engine2 = new Bpmn.Engine({
        source: state.source
      });
      const listener2 = new EventEmitter();
      listener2.once('wait-userTask', (task) => {
        task.signal();
      });
      engine2.resume(readFromDb(state), {
        listener: listener2
      }, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          done();
        });
      });
    });

    engine1.execute(options, (err) => {
      if (err) return done(err);
    });
  });

  lab.test('with require in saved state variables', (done) => {
    const processXml = `
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

    const engine1 = new Bpmn.Engine({
      source: processXml
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

      const engine2 = new Bpmn.Engine({
        source: state.source
      });
      const listener2 = new EventEmitter();
      listener2.once('wait-userTask', (task) => {
        task.signal();
      });
      engine2.resume(state, {
        listener: listener2
      }, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          done();
        });
      });
    });

    engine1.execute(options, (err) => {
      if (err) return done(err);
    });
  });

});

function readFromDb(state) {
  const source = state.source;
  delete state.source;
  const savedState = JSON.stringify(state, null, 2);
  const loadedState = JSON.parse(savedState);
  loadedState.source = source;
  return loadedState;
}
