'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');
const nock = require('nock');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('ScriptTask', () => {
  describe('events', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <scriptTask id="task" scriptFormat="Javascript">
          <script>
            <![CDATA[
              next(null, {input: 2});
            ]]>
          </script>
        </scriptTask>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(source, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('emits start on taken inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('start', () => {
        done();
      });

      task.inbound[0].take();
    });

    it('leaves on discarded inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('start', () => {
        fail('No start should happen');
      });
      task.once('leave', () => {
        done();
      });

      task.inbound[0].discard();
    });
  });

  describe('engine', () => {
    it('multiple inbound completes process', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="testProcess" isExecutable="true">
          <startEvent id="start" />
          <scriptTask id="task" scriptFormat="Javascript">
            <script>
              <![CDATA[
                next(null, output.taskInput && output.taskInput.decision.defaultTaken);
              ]]>
            </script>
          </scriptTask>
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
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activityApi) => {
        startCount++;
        if (startCount > 2) {
          fail(`<${activityApi.id}> Too many starts`);
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
        variables: {
          test: 1
        }
      });
      engine.once('end', (def) => {
        expect(def.getOutput().taskInput).to.equal({
          decision: {defaultTaken: true},
          task: true
        });

        expect(startCount, 'task starts').to.equal(2);
        expect(endEventCount, 'end event').to.equal(1);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });

  describe('execution', () => {
    it('executes script', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <scriptTask id="scriptTask" scriptFormat="Javascript">
            <script>
              <![CDATA[
                next(null, {input: variables.input});
              ]]>
            </script>
          </scriptTask>
          <endEvent id="theEnd" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
          <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (cerr, context) => {
        if (cerr) return done(cerr);
        context.environment.set('input', 1);

        const task = context.getChildActivityById('scriptTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          const api = activityApi.getApi(executionContext);
          expect(api.getOutput()).to.equal({input: 1});
          done();
        });

        task.inbound[0].take();
      });
    });

    it('emits error if returned in next function', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <scriptTask id="scriptTask" scriptFormat="Javascript">
          <script>
            <![CDATA[
              next(new Error('Inside'));
            ]]>
          </script>
        </scriptTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
        <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (cerr, context) => {
        if (cerr) return done(cerr);
        const task = context.getChildActivityById('scriptTask');

        task.once('error', (err, activityApi) => {
          expect(err).to.exist();
          expect(err).to.be.an.error(Error, 'Inside');
          expect(activityApi).to.include({id: 'scriptTask'});
          done();
        });

        task.run();
      });
    });

    it('can access services', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <scriptTask id="scriptTask" scriptFormat="Javascript">
          <script>
            <![CDATA[
              const request = services.request;

              const self = this;

              request.get('http://example.com/test', (err, resp, body) => {
                if (err) return next(err);
                next(null, JSON.parse(body));
              })
            ]]>
          </script>
        </scriptTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
        <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
        </process>
      </definitions>`;

      nock('http://example.com')
        .get('/test')
        .reply(200, {
          data: 2
        });

      testHelpers.getContext(processXml, (cerr, context) => {
        if (cerr) return done(cerr);

        context.environment.addService('request', {
          module: 'request'
        });

        const task = context.getChildActivityById('scriptTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          expect(executionContext.getOutput()).to.include({
            data: 2
          });
          done();
        });

        task.inbound[0].take();
      });
    });

    it('and even require', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <scriptTask id="scriptTask" scriptFormat="Javascript">
          <script>
            <![CDATA[
              const require = services.require;
              const request = require('request');

              const self = this;

              request.get('http://example.com/test', (err, resp, body) => {
                if (err) return next(err);
                next(null, JSON.parse(body));
              })
            ]]>
          </script>
        </scriptTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
        <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
        </process>
      </definitions>`;

      nock('http://example.com')
        .get('/test')
        .reply(200, {
          data: 3
        });

      testHelpers.getContext(processXml, (cerr, context) => {
        if (cerr) return done(cerr);

        context.environment.addService('require', {
          module: 'require',
          type: 'global'
        });

        context.environment.assignVariables({data: 1});

        const task = context.getChildActivityById('scriptTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          expect(executionContext.getOutput()).to.include({
            data: 3
          });
          done();
        });

        task.inbound[0].take();
      });
    });

    it('service function name', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <scriptTask id="scriptTask" scriptFormat="Javascript">
          <script>
            <![CDATA[
              const self = this;
              services.get('http://example.com/test', {json: true}, (err, resp, body) => {
                if (err) return next(err);
                next(null, body);
              })
            ]]>
          </script>
        </scriptTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
        <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
        </process>
      </definitions>`;

      nock('http://example.com')
        .defaultReplyHeaders({
          'Content-Type': 'application/json'
        })
        .get('/test')
        .reply(200, {
          data: 4
        });

      testHelpers.getContext(processXml, (cerr, context) => {
        if (cerr) return done(cerr);

        context.environment.addService('get', {
          module: 'request',
          type: 'require',
          fnName: 'get'
        });
        context.environment.assignVariables({data: 1});

        const task = context.getChildActivityById('scriptTask');
        task.activate();

        task.once('end', (activityApi, executionContext) => {
          expect(nock.isDone()).to.be.true();
          expect(executionContext.getOutput()).to.include({
            data: 4
          });
          done();
        });

        task.inbound[0].take();
      });
    });

    it('variables are editable and can be used for subsequent decisions', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <exclusiveGateway id="decision" default="flow4" />
        <scriptTask id="scriptTask" scriptFormat="Javascript">
          <script>
            <![CDATA[
              variables.stopLoop = true;
              next();
            ]]>
          </script>
        </scriptTask>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
        <sequenceFlow id="flow2" sourceRef="decision" targetRef="scriptTask">
          <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
          !this.variables.stopLoop
          ]]></conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow3" sourceRef="scriptTask" targetRef="decision" />
        <sequenceFlow id="flow4" sourceRef="decision" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });

      const listener = new EventEmitter();
      let count = 0;
      listener.on('start-scriptTask', () => {
        ++count;
        if (count > 2) {
          fail('too many starts');
        }
      });

      engine.execute({
        listener
      });

      engine.once('end', () => {
        done();
      });
    });
  });

  describe('output', () => {
    it('is passed by callback', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="scriptTask" scriptFormat="Javascript">
            <script>
              <![CDATA[
                this.variables.stopLoop = true;
                next(null, {output: 1});
              ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute();

      engine.once('end', (exec) => {
        expect(exec.getOutput().taskInput.scriptTask).to.equal({output: 1});
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
        const starts = [];
        task.on('start', (activity, activityExecution) => {
          const input = activityExecution.getInputContext();
          activityExecution.getIo().setInputValue('name', input.variables.names.shift());
          starts.push(activity.id);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          expect(starts).to.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      it('emits end when completed', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activity, activityExecution) => {
          const input = activityExecution.getInputContext();
          activityExecution.getIo().setInputValue('name', input.variables.names.shift());
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          done();
        });

        task.run();
      });

      it('getOutput() on end returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activity, activityExecution) => {
          const input = activityExecution.getInputContext();
          activityExecution.getIo().setInputValue('name', input.variables.names.shift());
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(executionContext.getOutput()).to.equal([{name: 'Pål'}, {name: 'Franz'}, {name: 'Immanuel'}]);
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

        const starts = [];
        task.on('start', (activityApi, activityExecution) => {
          const input = activityExecution.getInputContext();
          activityExecution.getIo().setInputValue('name', input.variables.names.shift());
          starts.push(activityExecution.id);
        });

        task.on('end', (activityApi, activityExecution) => {
          if (activityExecution.isLoopContext) return;

          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      it('returns output in sequence', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, activityExecution) => {
          const input = activityExecution.getInputContext();
          activityExecution.getIo().setInputValue('name', input.variables.names.shift());
        });

        task.on('end', (activityApi, activityExecution) => {
          if (activityExecution.isLoopContext) return;
          done();
        });

        task.run();
      });

      it('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activityApi, activityExecution) => {
          const input = activityExecution.getInputContext();
          activityExecution.getIo().setInputValue('name', input.variables.names.shift());
        });

        task.on('end', (activityApi, activityExecution) => {
          if (activityExecution.isLoopContext) return;

          expect(activityExecution.getOutput()).to.equal([{name: 'Pål'}, {name: 'Franz'}, {name: 'Immanuel'}]);

          done();
        });

        task.run();
      });
    });
  });

});

function getLoopContext(sequential, callback) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="sequentialLoopProcess" isExecutable="true">
      <scriptTask id="task" scriptFormat="javascript">
        <multiInstanceLoopCharacteristics isSequential="${sequential}">
          <loopCardinality>\${variables.names.length}</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <script><![CDATA[
          services.setTimeout(next, 25 - index * 5, null, {name});
        ]]></script>
      </scriptTask>
    </process>
  </definitions>`;
  testHelpers.getContext(source, (err, context) => {
    if (err) return callback(err);

    context.environment.set('names', ['Pål', 'Franz', 'Immanuel']);
    context.environment.addService('setTimeout', setTimeout);

    return callback(null, context);
  });
}

