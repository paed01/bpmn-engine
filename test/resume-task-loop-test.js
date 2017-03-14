'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const Bpmn = require('../');

lab.experiment('Resume task loop', () => {

  lab.test('resumes task cardinality loop', (done) => {
    const processXml = `
<definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="taskLoopProcess" isExecutable="true">
    <task id="recurring" name="Recurring">
      <multiInstanceLoopCharacteristics isSequential="true">
        <loopCardinality xsi:type="tFormalExpression">5</loopCardinality>
      </multiInstanceLoopCharacteristics>
    </task>
  </process>
</definitions>
    `;

    const engine1 = new Bpmn.Engine({
      source: processXml,
      moddleOptions: {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }
    });
    const listener = new EventEmitter();
    const options = {
      listener: listener
    };

    let state;
    let startCount = 0;
    listener.on('start-recurring', () => {
      startCount++;

      if (!state && startCount === 2) {
        state = engine1.getState();
        engine1.stop();
      }
    });

    engine1.once('end', () => {
      testHelpers.expectNoLingeringListenersOnEngine(engine1);

      const engine2 = Bpmn.Engine.resume(testHelpers.readFromDb(state), {listener: listener}, (err) => {
        if (err) return done(err);
      });

      engine2.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine2);

        expect(startCount).to.equal(5);
        done();
      });
    });

    engine1.execute(options, (err) => {
      if (err) return done(err);
    });
  });

  lab.describe('camunda collection expression', () => {

    lab.test('resumes task in collection loop', (done) => {
      const processXml = `
  <bpmn:definitions id= "Definitions_2" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="Process_1" isExecutable="true">
      <bpmn:serviceTask id="recurring" name="Each item" camunda:expression="\${services.loop}">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.list}" />
      </bpmn:serviceTask>
    </bpmn:process>
  </bpmn:definitions>
      `;

      testHelpers.loopFn = (executionContext, callback) => {

        const prevResult = executionContext.variables.taskInput ? executionContext.variables.taskInput.recurring[0] : -1;
        if (prevResult === -1) {
          return callback(null, executionContext.item);
        }
        callback(null, prevResult + executionContext.item);
      };

      const engine1 = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener1 = new EventEmitter();
      const options = {
        listener: listener1,
        variables: {
          list: [7, 3, 2, 1]
        },
        services: {
          loop: {
            module: './test/helpers/testHelpers',
            type: 'require',
            fnName: 'loopFn'
          }
        }
      };

      let state;
      listener1.once('end-recurring', () => {
        state = engine1.getState();
        engine1.stop();
      });

      engine1.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine1);

        const engine2 = Bpmn.Engine.resume(testHelpers.readFromDb(state), (err) => {
          if (err) return done(err);
        });

        engine2.once('end', (def) => {
          expect(def.processes[0].variables.taskInput.recurring[0]).to.equal(13);
          done();
        });

      });

      engine1.execute(options, (err) => {
        if (err) return done(err);
      });
    });
  });
});
