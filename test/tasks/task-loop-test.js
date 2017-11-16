'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

const extensions = {
  js: {
    moddleOptions: require('../resources/js-bpmn-moddle.json')
  }
};

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
        listener,
        variables: {
          input: 0,
          items: [0].concat(Array(10).fill(7))
        }
      });

      engine.on('end', () => {
        expect(startCount, 'number of start').to.equal(3);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
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
                output.sum = output.sum > 0 ? output.sum : 0;
                output.sum += variables.items[index];
                next()
              ]]></bpmn:script>
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
          listener,
          variables: {
            input: 0,
            items: [0].concat(Array(10).fill(7))
          }
        });

        engine.once('end', (execution, definition) => {
          expect(startCount, 'number of start').to.equal(7);
          expect(definition.environment.output.sum).to.equal(42);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
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
          listener
        }, (err) => {
          if (err) return done(err);

          expect(startCount).to.equal(5);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
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
          listener,
          variables: {
            loopCardinality: 7
          }
        }, (err) => {
          if (err) return done(err);

          expect(startCount).to.equal(7);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
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
                <bpmn:completionCondition xsi:type="bpmn:tFormalExpression"><![CDATA[typeof result !== 'undefined' && result[index].input > 3]]></bpmn:completionCondition>
              </bpmn:multiInstanceLoopCharacteristics>
            </bpmn:userTask>
          </bpmn:process>
        </bpmn:definitions>`;

        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        let waitCount = 0;
        listener.on('wait-recurring', (activityApi) => {
          if (waitCount > 5) fail(Error('Infinite loop'));

          activityApi.signal({
            input: ++waitCount
          });
        });

        engine.execute({
          listener
        }, (err) => {
          if (err) return done(err);

          expect(waitCount).to.equal(4);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });
      });

      it('loops service task until condition expression is met', (done) => {
        const source = `
        <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
          <process id="taskLoopProcess" isExecutable="true">
            <serviceTask id="recurring" name="Recurring" implementation="\${services.iterate}">
              <multiInstanceLoopCharacteristics isSequential="true">
                <completionCondition xsi:type="tFormalExpression">\${services.condition(variables.input)}</completionCondition>
              </multiInstanceLoopCharacteristics>
            </serviceTask>
          </process>
        </definitions>`;

        const engine = new Engine({
          source,
          moddleOptions
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
          listener,
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
        }, (err) => {
          if (err) return done(err);

          expect(startCount).to.equal(4);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });
      });

    });

    describe('collection expression', () => {
      it('loops each item', (done) => {
        const source = `
        <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
          <process id="Process_1" isExecutable="true">
            <serviceTask id="recurring" name="Each item" implementation="\${services.loop}">
              <multiInstanceLoopCharacteristics isSequential="true" js:collection="\${variables.input}" />
            </serviceTask>
          </process>
        </definitions>`;

        const engine = new Engine({
          source,
          extensions
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        let sum = 0;
        engine.execute({
          listener,
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
        engine.once('end', () => {
          expect(startCount).to.equal(4);
          expect(sum, 'sum').to.equal(13);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });

      });

      it('breaks loop if error is returned in callback', (done) => {
        const source = `
        <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
          <process id="Process_1" isExecutable="true">
            <serviceTask id="recurring" name="Each item" implementation="\${services.loop}">
              <multiInstanceLoopCharacteristics isSequential="true" js:collection="\${variables.input}" js:elementVariable="value" />
            </serviceTask>
            <boundaryEvent id="errorEvent" attachedToRef="recurring">
              <errorEventDefinition />
            </boundaryEvent>
          </process>
        </definitions>`;

        const engine = new Engine({
          source,
          extensions
        });
        const listener = new EventEmitter();

        let startCount = 0;
        listener.on('start-recurring', () => {
          startCount++;
        });

        engine.execute({
          listener,
          services: {
            loop: (executionContext, callback) => {
              if (executionContext.value > 1) {
                return callback(new Error('Too much'));
              }

              callback(null, executionContext.item);
            }
          },
          variables: {
            input: [1, 2, 3, 7]
          }
        }, (err) => {
          if (err) return done(err);
          expect(startCount).to.equal(2);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
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
        listener,
        variables: {
          cardinality: 13
        }
      }, (err) => {
        if (err) return done(err);

        expect(startCount).to.equal(9);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

  });

  describe('sequential', () => {
    const processXml = `
    <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <bpmn:process id="taskLoopProcess" isExecutable="true">
        <bpmn:serviceTask id="recurring" name="Recurring" implementation="\${services.loopTest}">
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
      testHelpers.getContext(processXml, moddleOptions, (err, c) => {
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

      task.on('leave', (activityApi, executionContext) => {
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

      task.on('end', (activityApi, activityExecution) => {
        if (activityExecution.isLoopContext) return;
        fail('Should have been stopped');
      });
      task.on('leave', () => {
        expect(startCount).to.equal(2);
        done();
      });
      task.run();

    });

    describe('resume', () => {
      it('resumes service task from state', (done) => {
        context.environment.addService('loopTest', (arg, next) => {
          const idx = arg.index;
          const tte = 20 - idx * 2;

          setTimeout(next, tte, null, idx);
        });

        const task = context.getChildActivityById('recurring');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        task.on('start', function startEH() {
          ++count;

          if (count < 2) return;
          task.removeListener('start', startEH);

          state = taskApi.getState();

          taskApi.stop();

          const resumeContext = context.clone();
          resumeContext.environment.addService('loopTest', (arg, next) => {
            const idx = arg.index;
            const tte = 20 - idx * 2;

            if (idx < 2) {
              expect(arg.resumed, `service resumed ${idx}`).to.be.true();
            } else {
              expect(arg.resumed, `service resumed ${idx}`).to.be.undefined();
            }

            setTimeout(next, tte, null, idx);
          });

          const resumeTask = resumeContext.getChildActivityById('recurring');

          resumeTask.on('start', () => {
            ++count;
            if (count > 4) fail('Too many starts');
          });
          resumeTask.on('leave', () => {
            expect(count).to.equal(4);
            done();
          });

          resumeTask.activate(state).resume();
        });

        task.activate().run();
      });

      it('only starts incomplete loop items', (done) => {
        context.environment.addService('loopTest', (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        });

        const task = context.getChildActivityById('recurring');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        task.on('end', function endEH() {
          ++count;

          if (count < 2) return;
          task.removeListener('end', endEH);

          taskApi.stop();
          state = taskApi.getState();

          expect(state.completed.length, 'completed before resume').to.equal(2);

          const resumeTask = context.clone().getChildActivityById('recurring');

          count = 0;
          resumeTask.on('start', () => {
            ++count;
            if (count > 2) fail('Too many starts');
          });
          resumeTask.on('leave', () => {
            expect(count, 'resumed').to.equal(1);
            done();
          });

          resumeTask.activate(state).resume();
        });

        task.activate().run();
      });

      it('returns completed result in output', (done) => {
        context.environment.addService('loopTest', (arg, next) => {
          const idx = arg.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        });

        const task = context.getChildActivityById('recurring');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        task.on('end', function endEH() {
          ++count;

          if (count < 2) return;
          task.removeListener('end', endEH);

          state = taskApi.getState();
          taskApi.stop();

          const resumeTask = context.clone().getChildActivityById('recurring');

          count = 0;
          resumeTask.on('start', () => {
            ++count;
            if (count > 3) fail('Too many starts');
          });
          resumeTask.on('leave', (activityApi, executionContext) => {
            expect(executionContext.getOutput()).to.equal([[0], [1], [2]]);
            done();
          });

          resumeTask.activate(state).resume();
        });

        task.activate().run();
      });

    });
  });

  describe('parallell', () => {
    const source = `
    <bpmn:definitions id= "definitions" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <bpmn:process id="taskLoopProcess" isExecutable="true">
        <bpmn:serviceTask id="recurring" name="Recurring" implementation="\${services.loopTest}">
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
      testHelpers.getContext(source, moddleOptions, (err, c) => {
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

      task.on('leave', (activityApi, executionContext) => {
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

      task.activate();
      errorEvent.activate();

      task.on('end', (activityApi, activityExecution) => {
        if (activityExecution.isLoopContext) return;
        fail('Should have been stopped');
      });
      errorEvent.on('end', () => {
        done();
      });

      task.run();
    });

    describe('resume', () => {
      it('resumes service task from state', (done) => {
        context.environment.addService('loopTest', (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        });

        const task = context.getChildActivityById('recurring');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        task.on('start', function startEH() {
          ++count;

          if (count < 2) return;
          task.removeListener('start', startEH);

          state = taskApi.getState();

          taskApi.stop();

          const resumeContext = context.clone();
          resumeContext.environment.addService('loopTest', (arg, next) => {
            const idx = arg.index;
            const tte = 20 - idx * 2;

            if (idx < 2) {
              expect(arg.resumed, `service resumed ${idx}`).to.be.true();
            } else {
              expect(arg.resumed, `service resumed ${idx}`).to.be.undefined();
            }

            setTimeout(next, tte, null, idx);
          });
          const resumeTask = resumeContext.getChildActivityById('recurring');

          resumeTask.on('start', () => {
            ++count;
            if (count > 6) fail('Too many starts');
          });
          resumeTask.on('leave', () => {
            expect(count).to.equal(5);
            done();
          });

          resumeTask.activate(state).resume();
        });

        task.activate().run();
      });

      it('only starts incomplete loop items', (done) => {
        context.environment.addService('loopTest', (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        });

        const task = context.getChildActivityById('recurring');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        task.on('end', function endEH() {
          ++count;

          if (count < 2) return;
          task.removeListener('end', endEH);

          state = taskApi.getState();
          taskApi.stop();

          expect(state.completed.length).to.equal(2);

          count = 0;
          task.on('start', () => {
            ++count;
            if (count > 3) fail('Too many starts');
          });
          task.on('leave', () => {
            expect(count).to.equal(1);
            done();
          });

          task.activate(state).resume();
        });

        task.activate().run();
      });

      it('returns completed result in output', (done) => {
        context.environment.addService('loopTest', (executionContext, next) => {
          const idx = executionContext.index;
          const tte = 20 - idx * 2;
          setTimeout(next, tte, null, idx);
        });

        const task = context.getChildActivityById('recurring');

        let count = 0, state, taskApi;
        task.once('enter', (activityApi, executionContext) => {
          taskApi = activityApi.getApi(executionContext);
        });

        task.on('end', function endEH() {
          ++count;

          if (count < 1) return;
          task.removeListener('end', endEH);

          state = taskApi.getState();
          taskApi.stop();

          const resumeTask = context.clone().getChildActivityById('recurring');

          count = 0;
          resumeTask.on('start', () => {
            ++count;
            if (count > 3) fail('Too many starts');
          });
          resumeTask.on('leave', (activityApi, executionContext) => {
            expect(executionContext.getOutput()).to.equal([[0], [1], [2]]);
            done();
          });

          resumeTask.activate(state).resume();
        });

        task.activate().run();
      });

    });
  });

  describe('resume', () => {
    it('resumes task cardinality loop', (done) => {
      const source = `
      <definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="taskLoopProcess" isExecutable="true">
          <task id="recurring" name="Recurring">
            <multiInstanceLoopCharacteristics isSequential="true">
              <loopCardinality xsi:type="tFormalExpression">5</loopCardinality>
            </multiInstanceLoopCharacteristics>
          </task>
        </process>
      </definitions>`;

      const engine1 = new Engine({
        source
      });
      const listener = new EventEmitter();
      const options = {
        listener
      };

      let state;
      let loopEndCount = 0;
      listener.on('end-recurring', (activityApi) => {
        if (activityApi.isLoopContext) loopEndCount++;
        if (!state && loopEndCount === 2) {
          state = engine1.getState();
          engine1.stop();
        }
      });

      engine1.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine1);

        const engine2 = Engine.resume(testHelpers.readFromDb(state), {listener}, (err) => {
          if (err) return done(err);
        });

        engine2.once('end', () => {
          testHelpers.expectNoLingeringListenersOnEngine(engine2);

          expect(loopEndCount).to.equal(5);
          done();
        });
      });

      engine1.execute(options);
    });

    it('resumes task in sequential collection loop', (done) => {
      const source = `
      <definitions id= "Definitions_2" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
        <process id="Process_1" isExecutable="true">
          <serviceTask id="recurring" name="Each item" implementation="\${services.loop}">
            <multiInstanceLoopCharacteristics isSequential="true" js:collection="\${variables.list}" />
          </serviceTask>
        </process>
      </definitions>`;

      let prevResult = -1;
      testHelpers.loopFn = (inputContext, callback) => {
        if (prevResult === -1) {
          prevResult = inputContext.item;
          return callback(null, inputContext.item);
        }
        callback(null, prevResult += inputContext.item);
      };

      const engine1 = new Engine({
        source,
        extensions
      });
      const listener = new EventEmitter();
      const options = {
        listener,
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
      listener.once('end-recurring', () => {
        state = engine1.getState();
        engine1.stop();
      });

      engine1.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine1);
        const engine2 = Engine.resume(testHelpers.readFromDb(state), {extensions});

        engine2.once('end', (def) => {
          expect(def.getOutput().taskInput.recurring).to.equal([
            [7], [10], [12], [13]
          ]);
          done();
        });

      });

      engine1.execute(options);
    });

  });
});
