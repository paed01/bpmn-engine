'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('ParallelGateway', () => {

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.getDefinition((err, definition) => {
      if (err) return done(err);

      const forkActivity = definition.getChildActivityById('fork');
      expect(forkActivity).to.include('inbound');
      expect(forkActivity.inbound).to.have.length(1);
      expect(forkActivity).to.include('outbound');
      expect(forkActivity.outbound).to.have.length(2);

      const joinActivity = definition.getChildActivityById('join');
      expect(joinActivity).to.include('inbound');
      expect(joinActivity.inbound).to.have.length(2);
      expect(joinActivity).to.include('outbound');
      expect(joinActivity.outbound).to.have.length(1);

      done();
    });
  });

  lab.test('should fork multiple diverging flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="end2" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute((err, definition) => {
      if (err) return done(err);

      definition.on('end', () => {
        expect(definition.getChildActivityById('end1').taken, 'end1').to.be.true();
        expect(definition.getChildActivityById('end2').taken, 'end2').to.be.true();
        done();
      });
    });
  });

  lab.test('should fork and join multiple diverging flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute((err, definition) => {
      if (err) return done(err);

      definition.on('end', () => {
        expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
        done();
      });
    });
  });

  lab.experiment('join', () => {
    lab.test('should join diverging fork', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow5" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('should join even if discarded flow', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" default="flow4" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="join" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="join" />
    <sequenceFlow id="flow5" sourceRef="decision" targetRef="join">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('should join discarded flow with tasks', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" />
    <scriptTask id="script" scriptFormat="Javascript">
      <script>next();</script>
    </scriptTask>
    <userTask id="task" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="script" />
    <sequenceFlow id="flow3" sourceRef="script" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="task">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
        this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow5" sourceRef="task" targetRef="join" />
    <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('regardless of flow order', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" />
    <userTask id="task" />
    <scriptTask id="script" scriptFormat="Javascript">
      <script>next();</script>
    </scriptTask>
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="task">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
        this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="task" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="script" />
    <sequenceFlow id="flow5" sourceRef="script" targetRef="join" />
    <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('and with default', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" default="flow4" />
    <userTask id="task" />
    <scriptTask id="script" scriptFormat="Javascript">
      <script>next();</script>
    </scriptTask>
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="script">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
        this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="script" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="task" />
    <sequenceFlow id="flow5" sourceRef="task" targetRef="join" />
    <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 50
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('completes process with multiple joins in discarded path', (done) => {
      const processXml = factory.resource('multiple-joins.bpmn');
      const engine = new Bpmn.Engine({
        source: processXml
      });

      const listener = new EventEmitter();
      let count = 0;
      listener.on('start-scriptTask2', (e) => {
        if (count > 1) Code.fail(`${e.id} should only run once`);
        count++;
      });

      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildActivityById('scriptTask1').taken, 'scriptTask1').to.be.true();
          expect(definition.getChildActivityById('scriptTask2').taken, 'scriptTask2').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

  });
});
