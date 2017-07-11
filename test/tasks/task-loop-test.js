'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');
const getPropertyValue = require('../../lib/getPropertyValue');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('task loop', () => {
  describe('sequential', () => {

    it('on recurring task error the loop breaks', (done) => {
      const source = `
      <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="taskLoopProcess" isExecutable="true">
          <bpmn:scriptTask id="recurring" name="Recurring" scriptFormat="JavaScript">
            <bpmn:multiInstanceLoopCharacteristics isSequential="true">
              <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">7</bpmn:loopCardinality>
            </bpmn:multiInstanceLoopCharacteristics>
            <bpmn:script><![CDATA[
              variables.input += variables.items[index];
              if (index >= 2) next(new Error('Three is enough'));
              else next();
              ]]>
            </bpmn:script>
          </bpmn:scriptTask>
          <bpmn:boundaryEvent id="errorEvent" attachedToRef="recurring">
            <bpmn:errorEventDefinition />
          </bpmn:boundaryEvent>
        </bpmn:process>
      </bpmn:definitions>`;

      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.execute({
        listener: listener,
        variables: {
          input: 0,
          items: [0].concat(Array(10).fill(7))
        }
      }, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount, 'number of start').to.equal(3);
          testHelpers.expectNoLingeringListenersOnDefinition(instance);
          done();
        });
      });
    });

    describe('cardinality', () => {
      it('loops script task until cardinality is reached', (done) => {
        const source = `
        <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="taskLoopProcess" isExecutable="true">
            <bpmn:scriptTask id="recurring" name="Recurring" scriptFormat="JavaScript">
              <bpmn:multiInstanceLoopCharacteristics isSequential="true">
                <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">7</bpmn:loopCardinality>
              </bpmn:multiInstanceLoopCharacteristics>
              <bpmn:script><![CDATA[
                variables.input += variables.items[index];
                next()
                ]]>
              </bpmn:script>
            </bpmn:scriptTask>
          </bpmn:process>
        </bpmn:definitions>`;

        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        engine.execute({
          listener: listener,
          variables: {
            input: 0,
            items: [0].concat(Array(10).fill(7))
          }
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(startCount, 'number of start').to.equal(7);
            expect(instance.variables.input).to.equal(42);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });

      it('loops task until cardinality is reached', (done) => {
        const source = `
        <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="taskLoopProcess" isExecutable="true">
            <bpmn:task id="recurring" name="Recurring">
              <bpmn:multiInstanceLoopCharacteristics isSequential="true">
                <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">5</bpmn:loopCardinality>
              </bpmn:multiInstanceLoopCharacteristics>
            </bpmn:task>
          </bpmn:process>
        </bpmn:definitions>`;

        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        engine.execute({
          listener: listener
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(startCount).to.equal(5);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });

      it('loops task until cardinality as expression is reached', (done) => {
        const source = `
        <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="taskLoopProcess" isExecutable="true">
            <bpmn:task id="recurring" name="Recurring">
              <bpmn:multiInstanceLoopCharacteristics isSequential="true">
                <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">\${variables.loopCardinality}</bpmn:loopCardinality>
              </bpmn:multiInstanceLoopCharacteristics>
            </bpmn:task>
          </bpmn:process>
        </bpmn:definitions>`;

        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        engine.execute({
          listener: listener,
          variables: {
            loopCardinality: 7
          }
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(startCount).to.equal(7);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });
    });

    describe('condition', () => {

      it('loops user task until condition is met', (done) => {
        const source = `
        <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="taskLoopProcess" isExecutable="true">
            <bpmn:userTask id="recurring" name="Recurring">
              <bpmn:multiInstanceLoopCharacteristics isSequential="true">
                <bpmn:completionCondition xsi:type="bpmn:tFormalExpression"><![CDATA[result && result[index].input > 3]]></bpmn:completionCondition>
              </bpmn:multiInstanceLoopCharacteristics>
            </bpmn:userTask>
          </bpmn:process>
        </bpmn:definitions>`;

        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        let waitCount = 0;
        listener.on('wait-recurring', (task, instance) => {
          if (waitCount > 5) throw new Error('Infinite loop');

          instance.signal('recurring', {
            input: ++waitCount
          });
        });

        engine.execute({
          listener: listener
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(waitCount).to.equal(4);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });

      it('loops service task until condition expression is met', (done) => {
        const source = `
        <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
          <process id="taskLoopProcess" isExecutable="true">
            <serviceTask id="recurring" name="Recurring" camunda:expression="\${services.iterate}">
              <multiInstanceLoopCharacteristics isSequential="true">
                <completionCondition xsi:type="tFormalExpression">\${services.condition(variables.input)}</completionCondition>
              </multiInstanceLoopCharacteristics>
            </serviceTask>
          </process>
        </definitions>`;

        const engine = new Engine({
          source,
          moddleOptions: {
            camunda: require('camunda-bpmn-moddle/resources/camunda')
          }
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        testHelpers.iterate = function(message, callback) {
          message.variables.input++;
          callback();
        };

        engine.execute({
          listener: listener,
          variables: {
            input: 0
          },
          services: {
            condition: (input) => {
              return input > 3;
            },
            iterate: {
              module: './test/helpers/testHelpers',
              fnName: 'iterate'
            }
          }
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(startCount).to.equal(4);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });

    });

    describe('camunda collection expression', () => {

      it('loops each item', (done) => {
        const source = `
        <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="Process_1" isExecutable="true">
            <bpmn:serviceTask id="recurring" name="Each item" camunda:expression="\${services.loop}">
              <bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.input}" />
              <bpmn:extensionElements>
                <camunda:inputOutput>
                  <camunda:outputParameter name="sum">\${result[-1][0]}</camunda:outputParameter>
                </camunda:inputOutput>
              </bpmn:extensionElements>
            </bpmn:serviceTask>
          </bpmn:process>
        </bpmn:definitions>`;

        const engine = new Engine({
          source,
          moddleOptions: {
            camunda: require('camunda-bpmn-moddle/resources/camunda')
          }
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        let sum = 0;
        engine.execute({
          listener: listener,
          services: {
            loop: (executionContext, callback) => {
              sum += executionContext.item;
              callback(null, sum);
            }
          },
          variables: {
            input: [1, 2, 3, 7]
          }
        });
        engine.once('end', (instance) => {
          expect(startCount).to.equal(4);
          expect(sum, 'sum').to.equal(13);
          testHelpers.expectNoLingeringListenersOnDefinition(instance);
          done();
        });

      });

      it('breaks loop if error is returned in callback', (done) => {
        const source = `
        <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <process id="Process_1" isExecutable="true">
            <serviceTask id="recurring" name="Each item" camunda:expression="\${services.loop}">
              <multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.input}" />
            </serviceTask>
            <boundaryEvent id="errorEvent" attachedToRef="recurring">
              <errorEventDefinition />
            </boundaryEvent>
          </process>
        </definitions>`;

        const engine = new Engine({
          source,
          moddleOptions: {
            camunda: require('camunda-bpmn-moddle/resources/camunda')
          }
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        engine.execute({
          listener: listener,
          services: {
            loop: (executionContext, callback) => {
              if (executionContext.item > 1) {
                return callback(new Error('Too much'));
              }

              callback(null, executionContext.item);
            }
          },
          variables: {
            input: [1, 2, 3, 7]
          }
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(startCount).to.equal(2);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });
    });
  });

  describe('combination', () => {
    it('with condition and cardinality loops script task until condition is met', (done) => {
      const source = `
      <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="taskLoopProcess" isExecutable="true">
          <bpmn:scriptTask id="recurring" name="Recurring" scriptFormat="JavaScript">
            <bpmn:multiInstanceLoopCharacteristics isSequential="true">
              <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">index > 8</bpmn:completionCondition>
              <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">\${variables.cardinality}</bpmn:loopCardinality>
            </bpmn:multiInstanceLoopCharacteristics>
            <bpmn:script><![CDATA[
              'use strict';
              var input = index;
              next(null, {input: input})
              ]]>
            </bpmn:script>
          </bpmn:scriptTask>
        </bpmn:process>
      </bpmn:definitions>`;

      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      let startCount = 0;
      listener.on('start-recurring', () => {
        startCount++;
      });

      engine.execute({
        listener: listener,
        variables: {
          cardinality: 13
        }
      }, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(startCount).to.equal(9);
          testHelpers.expectNoLingeringListenersOnDefinition(instance);
          done();
        });
      });
    });

  });

  describe('sequential', () => {
    const processXml = `
    <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
       xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="taskLoopProcess" isExecutable="true">
        <bpmn:serviceTask id="recurring" name="Recurring" camunda:expression="\${services.loopTest}">
          <bpmn:multiInstanceLoopCharacteristics isSequential="true">
            <bpmn:loopCardinality>3</bpmn:loopCardinality>
          </bpmn:multiInstanceLoopCharacteristics>
        </bpmn:serviceTask>
        <bpmn:boundaryEvent id="errorEvent" attachedToRef="recurring">
          <bpmn:errorEventDefinition />
        </bpmn:boundaryEvent>
      </bpmn:process>
    </bpmn:definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    it('runs loop on inbound', (done) => {
      context.environment.addService('loopTest', (executionContext, next) => {
        const idx = executionContext.index;
        const tte = 20 - idx * 2;
        setTimeout(next, tte, null, idx);
      });

      const task = context.getChildActivityById('recurring');

      task.activate();

      task.on('end', (activityApi, executionContext) => {
        const compare = [ [0], [1], [2] ];
        expect(executionContext.getOutput()).to.equal(compare);
        done();
      });

      task.run();
    });

    it('breaks loop on error', (done) => {
      context.environment.addService('loopTest', (executionContext, next) => {
        const idx = executionContext.index;
        const tte = 20 - idx * 2;
        setTimeout(next, tte, idx === 1 && new Error('break'), idx);
      });

      const task = context.getChildActivityById('recurring');
      const errorEvent = context.getChildActivityById('errorEvent');
      errorEvent.activate();

      task.activate();
      let startCount = 0;
      task.on('start', () => {
        startCount++;
      });

      task.on('leave', () => {
        expect(startCount).to.equal(2);
        done();
      });
      task.run();

    });
  });

  describe('parallell', () => {
    const processXml = `
    <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
       xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="taskLoopProcess" isExecutable="true">
        <bpmn:serviceTask id="recurring" name="Recurring" camunda:expression="\${services.loopTest}">
          <bpmn:multiInstanceLoopCharacteristics isSequential="false">
            <bpmn:loopCardinality>3</bpmn:loopCardinality>
          </bpmn:multiInstanceLoopCharacteristics>
        </bpmn:serviceTask>
        <bpmn:boundaryEvent id="errorEvent" attachedToRef="recurring">
          <bpmn:errorEventDefinition />
        </bpmn:boundaryEvent>
      </bpmn:process>
    </bpmn:definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    it('runs loop on inbound', (done) => {
      context.environment.addService('loopTest', (executionContext, next) => {
        const idx = executionContext.index;
        const tte = 20 - idx * 2;
        setTimeout(next, tte, null, idx);
      });

      const task = context.getChildActivityById('recurring');

      task.activate();

      task.on('end', (activityApi, executionContext) => {
        const compare = [ [0], [1], [2] ];
        expect(executionContext.getOutput()).to.equal(compare);
        done();
      });
      task.run();

    });

    it('breaks loop on error', (done) => {
      context.environment.addService('loopTest', (executionContext, next) => {
        const idx = executionContext.index;
        const tte = 20 - idx * 2;
        setTimeout(next, tte, idx === 1 && new Error('break'), idx);
      });

      const task = context.getChildActivityById('recurring');
      const errorEvent = context.getChildActivityById('errorEvent');
      const errorEventApi = errorEvent.activate();

      task.activate();

      task.on('leave', () => {
        expect(errorEventApi.getState().taken).to.be.true();
        done();
      });
      task.run();

    });
  });

});
