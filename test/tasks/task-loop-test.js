'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../../');
const expect = Code.expect;

lab.experiment('task loop', () => {
  lab.describe('sequential', () => {

    lab.test('with condition and cardinality loops script task until condition is met', (done) => {
      const def = `
  <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:scriptTask id="recurring" name="Recurring" scriptFormat="JavaScript">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">context.taskInput.recurring.input > 8</bpmn:completionCondition>
          <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">13</bpmn:loopCardinality>
        </bpmn:multiInstanceLoopCharacteristics>
        <bpmn:script><![CDATA[
          'use strict';
          var input = index;
          next(null, {input: input})
          ]]>
        </bpmn:script>
      </bpmn:scriptTask>
    </bpmn:process>
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine(def);
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.startInstance(null, listener, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount).to.equal(10);
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });

    lab.test('with cardinality loops script task until it has finished', (done) => {
      const def = `
  <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:scriptTask id="recurring" name="Recurring" scriptFormat="JavaScript">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">7</bpmn:loopCardinality>
        </bpmn:multiInstanceLoopCharacteristics>
        <bpmn:script><![CDATA[
          context.input += context.items[index];
          next()
          ]]>
        </bpmn:script>
      </bpmn:scriptTask>
    </bpmn:process>
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine(def);
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.startInstance({
        input: 0,
        items: [0].concat(Array(10).fill(7))
      }, listener, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount, 'number of start').to.equal(7);
          expect(instance.variables.input).to.equal(42);
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });

    lab.test('with cardinality loops task until cardinality is reached', (done) => {
      const def = `
  <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:task id="recurring" name="Recurring">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">5</bpmn:loopCardinality>
        </bpmn:multiInstanceLoopCharacteristics>
      </bpmn:task>
    </bpmn:process>
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine(def);
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.startInstance(null, listener, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount).to.equal(5);
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });

    lab.test('loops user task until condition is met', (done) => {
      const def = `
  <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:userTask id="recurring" name="Recurring">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">context.taskInput.recurring.input > 3</bpmn:completionCondition>
        </bpmn:multiInstanceLoopCharacteristics>
      </bpmn:userTask>
    </bpmn:process>
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine(def);
      const listener = new EventEmitter();

      let waitCount = 0;
      listener.on('wait-recurring', (task, instance) => {
        instance.signal('recurring', {input: ++waitCount});
      });

      engine.startInstance(null, listener, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(waitCount).to.equal(4);
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });

    lab.test('loops sub process until condition is met', (done) => {
      const def = `
  <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:subProcess id="recurring">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">context.index > 3</bpmn:completionCondition>
          <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">5</bpmn:loopCardinality>
        </bpmn:multiInstanceLoopCharacteristics>
        <bpmn:task id="subTask" name="Sub task" />
      </bpmn:subProcess>
    </bpmn:process>
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine(def);
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.startInstance(null, listener, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount).to.equal(5);
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });

    lab.test('on recurring task error the loop breaks', (done) => {
      const def = `
  <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:scriptTask id="recurring" name="Recurring" scriptFormat="JavaScript">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">7</bpmn:loopCardinality>
        </bpmn:multiInstanceLoopCharacteristics>
        <bpmn:script><![CDATA[
          context.input += context.items[index];
          if (index >= 2) next(new Error('Three is enough'));
          else next();
          ]]>
        </bpmn:script>
      </bpmn:scriptTask>
      <bpmn:boundaryEvent id="errorEvent" attachedToRef="recurring">
        <bpmn:errorEventDefinition />
      </bpmn:boundaryEvent>
    </bpmn:process>
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine(def);
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.startInstance({
        input: 0,
        items: [0].concat(Array(10).fill(7))
      }, listener, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount, 'number of start').to.equal(3);
          expect(instance.variables.input).to.equal(14);
          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });
  });
});
