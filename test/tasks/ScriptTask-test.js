'use strict';

const Code = require('code');
const Lab = require('lab');
const nock = require('nock');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');
const mapper = require('../../lib/mapper');
const BaseProcess = mapper.Process;

lab.experiment('ScriptTask', () => {
  lab.describe('ctor', () => {
    lab.test('throws if type is not JavaScript', (done) => {
      const activity = {
        $type: 'bpmn:ScriptTask',
        scriptFormat: 'Java'
      };

      function test() {
        new (mapper(activity.$type))(activity); // eslint-disable-line no-new
      }

      expect(test).to.throw(Error, /Java is unsupported/i);
      done();
    });

    lab.test('throws if type is undefined', (done) => {
      const activity = {
        $type: 'bpmn:ScriptTask'
      };

      function test() {
        new (mapper(activity.$type))(activity); // eslint-disable-line no-new
      }

      expect(test).to.throw(Error, /undefined is unsupported/i);
      done();
    });

    lab.test('should have inbound and outbound sequence flows', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <scriptTask id="scriptTask" scriptFormat="Javascript">
      <script>
        <![CDATA[
          next(null, {input: 2});
        ]]>
      </script>
    </scriptTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
    <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
    </process>
  </definitions>`;

      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('scriptTask');
        expect(task).to.include('inbound');
        expect(task.inbound).to.have.length(1);
        expect(task).to.include('outbound');
        expect(task.outbound).to.have.length(1);
        done();
      });
    });

    lab.test('is considered end if without outbound sequenceFlows', (done) => {
      const alternativeProcessXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
    <scriptTask id="scriptTask" scriptFormat="Javascript">
      <script>
        <![CDATA[
          this.context.input = 2;
          next();
        ]]>
      </script>
    </scriptTask>
    </process>
  </definitions>`;

      testHelpers.getModdleContext(alternativeProcessXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('scriptTask');
        expect(task.isEnd).to.be.true();
        done();
      });
    });
  });

  lab.experiment('execution', () => {
    lab.test('executes script', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        this.variables.input++;
        next(null, {input: this.variables.input});
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 1
        }
      }, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(instance.variables.input, 'input variable').to.equal(2);
          testHelpers.expectNoLingeringListenersOnDefinition(instance);
          done();
        });
      });
    });

    lab.test('emits error if returned in next function', (done) => {
      const processXml = `
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

      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('scriptTask');

        task.once('error', (e, tsk) => {
          expect(e).to.exist();
          expect(e).to.be.an.error(Error, 'Inside');
          expect(tsk).to.include({id: 'scriptTask'});
          done();
        });

        task.run();
      });
    });
  });

  lab.experiment('context variables', () => {
    lab.before((done) => {
      nock.disableNetConnect();
      done();
    });
    lab.after((done) => {
      nock.cleanAll();
      done();
    });

    lab.test('accepts module in context variables', (done) => {
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
        const result = JSON.parse(body);
        self.variables.data = result.data;
        next();
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

      const engine = new Bpmn.Engine({
        source: processXml
      });
      const options = {
        services: {
          request: {
            module: 'request'
          }
        }
      };

      engine.execute(options, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          expect(execution.variables).to.include({
            data: 2
          });
          done();
        });
      });
    });

    lab.test('and even require', (done) => {
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
        const result = JSON.parse(body);
        self.variables.data = result.data;
        next();
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

      const engine = new Bpmn.Engine({
        source: processXml
      });
      const options = {
        services: {
          require: {
            module: 'require',
            type: 'global'
          }
        },
        variables: {
          data: 1
        }
      };
      engine.execute(options, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          expect(execution.variables).to.include({
            data: 3
          });
          done();
        });
      });
    });

    lab.test('service function name', (done) => {
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
        self.variables.data = body.data;
        next();
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

      const engine = new Bpmn.Engine({
        source: processXml
      });
      const options = {
        services: {
          get: {
            module: 'request',
            type: 'require',
            fnName: 'get'
          }
        },
        variables: {
          data: 1
        }
      };
      engine.execute(options, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          expect(execution.variables).to.include({
            data: 4
          });
          done();
        });
      });
    });

    lab.test('can be used for subsequent decisions', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<process id="theProcess" isExecutable="true">
<startEvent id="start" />
<exclusiveGateway id="decision" default="flow4" />
<scriptTask id="scriptTask" scriptFormat="Javascript">
  <script>
    <![CDATA[
      this.variables.stopLoop = true;
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

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          done();
        });
      });
    });
  });

  lab.describe('output', () => {
    lab.test('is passed by callback', (done) => {
      const processXml = `
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

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(execution.variables.taskInput.scriptTask.output).to.equal(1);
          done();
        });
      });
    });

    lab.test('with output parameters returns formatted output', (done) => {
      const processXml = `
<definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="1.6.0">
  <process id="Process_1" isExecutable="true">
    <scriptTask id="scriptTask" name="Execute" scriptFormat="JavaScript">
      <extensionElements>
        <camunda:inputOutput>
          <camunda:inputParameter name="input">\${variables.input}</camunda:inputParameter>
          <camunda:inputParameter name="path">/api/v8</camunda:inputParameter>
          <camunda:outputParameter name="calledApi">\${api}</camunda:outputParameter>
          <camunda:outputParameter name="result"></camunda:outputParameter>
        </camunda:inputOutput>
      </extensionElements>
      <incoming>SequenceFlow_1jgxkq2</incoming>
      <outgoing>SequenceFlow_040np9m</outgoing>
      <script><![CDATA[
      next(null, {
        api: variables.apiPath + path,
        result: input
      })]]></script>
    </scriptTask>
  </process>
</definitions>
        `;
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, localContext) => {
        if (err) return done(err);

        localContext.variables = {
          apiPath: 'http://example-2.com',
          input: 8
        };

        const task = localContext.getChildActivityById('scriptTask');

        task.once('end', (activity, output) => {
          expect(output).to.equal({
            calledApi: 'http://example-2.com/api/v8',
            result: 8
          });
          done();
        });

        task.enter();
        task.execute();
      });
    });
  });

});
