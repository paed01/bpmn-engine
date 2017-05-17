'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');
const getPropertyValue = require('../../lib/getPropertyValue');

const lab = exports.lab = Lab.script();
const Bpmn = require('../../');
const expect = Code.expect;

lab.experiment('task loop', () => {
  lab.describe('sequential', () => {

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
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine({
        source: def
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

    lab.describe('cardinality', () => {
      lab.test('loops script task until cardinality is reached', (done) => {
        const def = `
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
    </bpmn:definitions>
      `;

        const engine = new Bpmn.Engine({
          source: def
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

      lab.test('loops task until cardinality is reached', (done) => {
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

        const engine = new Bpmn.Engine({
          source: def
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

      lab.test('loops task until cardinality as expression is reached', (done) => {
        const def = `
    <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="taskLoopProcess" isExecutable="true">
        <bpmn:task id="recurring" name="Recurring">
          <bpmn:multiInstanceLoopCharacteristics isSequential="true">
            <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">\${variables.loopCardinality}</bpmn:loopCardinality>
          </bpmn:multiInstanceLoopCharacteristics>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>
      `;

        const engine = new Bpmn.Engine({
          source: def
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

    lab.describe('condition', () => {

      lab.test('loops user task until condition is met', (done) => {
        const def = `
  <bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="taskLoopProcess" isExecutable="true">
      <bpmn:userTask id="recurring" name="Recurring">
        <bpmn:multiInstanceLoopCharacteristics isSequential="true">
          <bpmn:completionCondition xsi:type="bpmn:tFormalExpression"><![CDATA[result[index].input > 3]]></bpmn:completionCondition>
        </bpmn:multiInstanceLoopCharacteristics>
      </bpmn:userTask>
    </bpmn:process>
  </bpmn:definitions>
    `;

        const engine = new Bpmn.Engine({
          source: def
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

      lab.test('loops sub process until cardinality is met', (done) => {
        const def = `
  <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
    <process id="taskLoopProcess" isExecutable="true">
      <subProcess id="recurring">
        <multiInstanceLoopCharacteristics isSequential="true">
          <completionCondition xsi:type="tFormalExpression">variables.index > 3</completionCondition>
          <loopCardinality xsi:type="tFormalExpression">5</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <serviceTask id="recurringChild" name="Each item" camunda:expression="\${services.sum}" />
      </subProcess>
    </process>
  </definitions>
    `;

        const engine = new Bpmn.Engine({
          source: def,
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
            sum: (executionContext, callback) => {
              const sum = getPropertyValue(executionContext, 'variables.taskInput.recurringChild[0]', 0);
              callback(null, sum + executionContext.variables.index);
            }
          }
        }, (err, instance) => {
          if (err) return done(err);

          instance.once('end', () => {
            expect(startCount).to.equal(5);
            expect(instance.variables.taskInput.recurring[0].taskInput.recurringChild[0]).to.equal(10);
            testHelpers.expectNoLingeringListenersOnDefinition(instance);
            done();
          });
        });
      });

      lab.test('loops service task until condition expression is met', (done) => {
        const def = `
<definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="taskLoopProcess" isExecutable="true">
    <serviceTask id="recurring" name="Recurring" camunda:expression="\${services.iterate}">
      <multiInstanceLoopCharacteristics isSequential="true">
        <completionCondition xsi:type="tFormalExpression">\${services.condition(variables.input)}</completionCondition>
      </multiInstanceLoopCharacteristics>
    </serviceTask>
  </process>
</definitions>
    `;

        const engine = new Bpmn.Engine({
          source: def,
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

    lab.describe('camunda collection expression', () => {

      lab.test('loops each item', (done) => {
        const def = `
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
</bpmn:definitions>
    `;

        const engine = new Bpmn.Engine({
          source: def,
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
              const prevResult = getPropertyValue(executionContext, '_result.sum', 0);
              callback(null, prevResult + executionContext.item);
            }
          },
          variables: {
            input: [1, 2, 3, 7]
          }
        });
        engine.once('end', (instance) => {
          expect(startCount).to.equal(4);
          expect(instance.variables.sum, 'sum').to.equal(13);
          testHelpers.expectNoLingeringListenersOnDefinition(instance);
          done();
        });

      });

      lab.test('breaks loop if error is returned in callback', (done) => {
        const def = `
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
</definitions>
    `;

        const engine = new Bpmn.Engine({
          source: def,
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

  lab.describe('combination', () => {
    lab.test('with condition and cardinality loops script task until condition is met', (done) => {
      const def = `
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
  </bpmn:definitions>
    `;

      const engine = new Bpmn.Engine({
        source: def
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
          expect(startCount).to.equal(10);
          testHelpers.expectNoLingeringListenersOnDefinition(instance);
          done();
        });
      });
    });

  });

  lab.describe('sequential', () => {
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
    lab.beforeEach((done) => {
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    lab.test('runs loop on inbound', (done) => {
      context.services = {
        loopTest: (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        }
      };

      const task = context.getChildActivityById('recurring');

      task.activate();

      task.on('end', (t, result) => {
        const compare = [ [0], [1], [2] ];
        expect(task.getOutput()).to.equal(compare);
        expect(result).to.equal(compare);
        done();
      });
      task.run();

    });

    lab.test('breaks loop on error', (done) => {
      context.services = {
        loopTest: (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, idx === 1 && new Error('break'), idx);
        }
      };

      const task = context.getChildActivityById('recurring');
      const errorEvent = context.getChildActivityById('errorEvent');
      errorEvent.activate();

      task.activate();

      task.on('leave', () => {
        expect(task.getInput()).to.include({index: 1});
        expect(task.getOutput()).to.equal([[0]]);
        done();
      });
      task.run();

    });
  });

  lab.describe('parallell', () => {
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
    lab.beforeEach((done) => {
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    lab.test('runs loop on inbound', (done) => {
      context.services = {
        loopTest: (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        }
      };

      const task = context.getChildActivityById('recurring');

      task.activate();

      task.on('end', (t, result) => {
        const compare = [ [0], [1], [2] ];
        expect(task.getOutput()).to.equal(compare);
        expect(result).to.equal(compare);
        done();
      });
      task.run();

    });

    lab.test('breaks loop on error', (done) => {
      context.services = {
        loopTest: (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, idx === 1 && new Error('break'), idx);
        }
      };

      const task = context.getChildActivityById('recurring');
      const errorEvent = context.getChildActivityById('errorEvent');
      errorEvent.activate();

      task.activate();

      task.on('leave', () => {
        expect(errorEvent.taken).to.be.true();
        expect(task.getInput()).to.include(['index']);
        done();
      });
      task.run();

    });
  });

});
