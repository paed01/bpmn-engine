'use strict';

const Code = require('code');
const Lab = require('lab');
const nock = require('nock');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('ScriptTask', () => {

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        this.context.input = 2;
        next();
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const activity = execution.getChildActivityById('scriptTask');
      expect(activity).to.include('inbound');
      expect(activity.inbound).to.have.length(1);
      expect(activity).to.include('outbound');
      expect(activity.outbound).to.have.length(1);
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

    const engine = new Bpmn.Engine(alternativeProcessXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const task = execution.getChildActivityById('scriptTask');
      expect(task.isEnd).to.be.true();
      done();
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
        this.context.input++;
        next();
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 1
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables.input, 'input variable').to.equal(2);
          testHelper.expectNoLingeringListeners(execution);
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

      const engine = new Bpmn.Engine(processXml);
      engine.getInstance(null, null, (err, execution) => {
        if (err) return done(err);
        const activity = execution.getChildActivityById('scriptTask');

        activity.once('error', (e) => {
          expect(e).to.exist();
          expect(e).to.be.an.error(Error, 'Inside');
          done();
        });

        activity.run();
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
      const request = context.request;

      const self = this;

      request.get('http://example.com/test', (err, resp, body) => {
        if (err) return next(err);
        const result = JSON.parse(body);
        self.context.data = result.data;
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

      const engine = new Bpmn.Engine(processXml);
      const variables = {
        request: require('request')
      };

      engine.startInstance(variables, null, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          expect(execution.variables).to.include('data', 2);
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
      const require = context.require;
      const request = require('request');

      const self = this;

      request.get('http://example.com/test', (err, resp, body) => {
        if (err) return next(err);
        const result = JSON.parse(body);
        self.context.data = result.data;
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

      const engine = new Bpmn.Engine(processXml);
      const variables = {
        require: require,
        data: 1
      };
      engine.startInstance(variables, null, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          expect(execution.variables).to.include('data', 2);
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
      this.context.stopLoop = true;
      next();
    ]]>
  </script>
</scriptTask>
<endEvent id="end" />
<sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
<sequenceFlow id="flow2" sourceRef="decision" targetRef="scriptTask">
  <conditionExpression xsi:type="tFormalExpression"><![CDATA[
  !this.context.stopLoop
  ]]></conditionExpression>
</sequenceFlow>
<sequenceFlow id="flow3" sourceRef="scriptTask" targetRef="decision" />
<sequenceFlow id="flow4" sourceRef="decision" targetRef="end" />
</process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(nock.isDone()).to.be.true();
          done();
        });
      });
    });
  });
});
