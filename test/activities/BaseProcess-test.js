'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const mapper = require('../../lib/mapper');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

const BaseProcess = mapper.Process;
const Definition = mapper.Definition;

lab.experiment('BaseProcess', () => {

  lab.describe('ctor', () => {
    lab.test('main process context stores message flows', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.mainProcess, moddleContext, {});
        expect(process.context.messageFlows.length).to.equal(1);
        done();
      });
    });
  });

  lab.describe('run()', () => {
    let instance;
    lab.test('process is initiated', (done) => {
      const listener = new EventEmitter();
      const options = {
        services: {
          runService: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn',
            type: 'require'
          }
        },
        variables: {
          input: 0
        },
        listener: listener
      };

      testHelpers.getModdleContext(factory.resource('mother-of-all.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        instance = new BaseProcess(moddleContext.elementsById.motherOfAll, moddleContext, options);
        listener.on('wait', (activity) => {
          activity.signal({
            input: 1
          });
        });

        done();
      });
    });

    lab.test('emits end when completed', (done) => {
      instance.once('end', () => {
        testHelpers.expectNoLingeringListeners(instance);
        done();
      });
      instance.run();
    });

    lab.test('can be ran twice', (done) => {
      instance.once('end', () => {
        testHelpers.expectNoLingeringListeners(instance);
        done();
      });
      instance.run();
    });
  });

  lab.describe('empty process', () => {

    lab.test('emits end when completed', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theEmptyProcess" isExecutable="true" />
  </definitions>`;

      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theEmptyProcess, moddleContext, {});
        process.once('end', () => {
          done();
        });
        process.run();
      });
    });

  });

  lab.describe('ad hoc process', () => {

    lab.test('starts all without inbound', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theUncontrolledProcess" isExecutable="true">
      <userTask id="userTask" />
      <scriptTask id="task2" scriptFormat="JavaScript">
        <script>
          <![CDATA[
            this.variables.input = 2;
            next();
          ]]>
        </script>
      </scriptTask>
    </process>
  </definitions>`;

      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theUncontrolledProcess, moddleContext, {});
        const userTask = process.getChildActivityById('userTask');
        userTask.once('wait', () => {
          setTimeout(userTask.signal.bind(userTask, 'von Rosen'), 50);
        });

        process.once('end', () => {
          expect(process.getChildActivityById('task2').taken, 'task2 taken').to.be.true();
          expect(process.getChildActivityById('userTask').taken, 'userTask taken').to.be.true();

          expect(process.variables.input).to.equal(2);
          expect(process.variables.taskInput.userTask).to.equal('von Rosen');

          done();
        });
        process.run();
      });
    });

    lab.test('starts task without inbound and then ends without outbound', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theUncontrolledProcess" isExecutable="true">
      <userTask id="task1" />
      <scriptTask id="task2" scriptFormat="JavaScript">
        <script>
          <![CDATA[
            const self = this;
            function setContextVariable(callback) {
              if (!self.variables.taskInput) {
                return callback(new Error('Missing task input'));
              }

              self.variables.userWrote = self.variables.taskInput.task1;
              callback();
            }
            setContextVariable(next);
          ]]>
        </script>
      </scriptTask>
      <sequenceFlow id="flow1" sourceRef="task1" targetRef="task2" />
    </process>
  </definitions>`;

      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theUncontrolledProcess, moddleContext, {});
        const userTask = process.getChildActivityById('task1');
        userTask.once('wait', () => userTask.signal('von Rosen'));

        process.once('end', () => {
          expect(process.getChildActivityById('task1').taken).to.be.true();
          expect(process.getChildActivityById('task2').taken).to.be.true();

          expect(process.variables.taskInput.task1).to.equal('von Rosen');
          expect(process.variables.userWrote).to.equal('von Rosen');

          done();
        });
        process.run();
      });
    });
  });

  lab.describe('loop', () => {
    let definition;
    lab.test('given the definition is initiated', (done) => {
      testHelpers.getModdleContext(factory.resource('loop.bpmn'), (err, result) => {
        if (err) return done(err);
        definition = new Definition(result);
        done();
      });
    });

    lab.test('completes process when executed', (done) => {
      const listener = new EventEmitter();
      let startCount = 0;
      let endCount = 0;
      let leaveCount = 0;

      listener.on('start-scriptTask1', () => {
        startCount++;
      });
      listener.on('end-theEnd', () => {
        endCount++;
      });
      listener.on('leave-scriptTask2', () => {
        leaveCount++;
        if (leaveCount > 3) {
          done(new Error('Infinite loop'));
        }
      });

      definition.execute({
        variables: {
          input: 0
        },
        listener: listener
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(startCount, 'scriptTask1 starts').to.equal(3);
          expect(instance.variables.input).to.equal(2);

          expect(instance.getChildActivityById('theEnd').taken).to.be.true();

          expect(endCount, 'theEnd count').to.equal(1);

          testHelpers.expectNoLingeringListeners(instance);
          done();
        });
      });
    });
  });

  lab.describe('multiple end events', () => {
    const processXml = factory.resource('multiple-endEvents.bpmn');
    lab.test('completes all flows', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 0
        }
      }, (err, definition) => {
        if (err) return done(err);
        definition.once('end', () => {
          expect(definition.variables.input, 'iterated input').to.equal(2);
          done();
        });
      });
    });
  });

  lab.describe('boundary timeout event', () => {
    const processXml = factory.resource('boundary-timeout.bpmn');

    lab.test('timer boundary event with cancel task completes', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });

      const listener = new EventEmitter();
      listener.once('end-userTask', (e) => {
        Code.fail(`<${e.id}> should not have reached end`);
      });

      engine.execute({
        variables: {
          input: 0
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('timer boundary event is discarded if task completes', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });

      const listener = new EventEmitter();
      listener.on('wait-userTask', (activity) => {
        activity.signal({
          input: 1
        });
      });

      listener.once('end-boundTimeoutEvent', (e) => {
        Code.fail(`<${e.id}> should not have reached end`);
      });

      engine.execute({
        listener: listener,
        variables: {
          input: 0
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });
  });

  lab.describe('getState()', () => {
    lab.test('returns state of processes activities', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.userTask()
      });
      const listener = new EventEmitter();

      listener.on('wait-userTask', (task, process) => {
        const state = process.getState();
        expect(state, 'tasks').to.include('children');
        expect(state.children.find(c => c.id === 'theStart')).to.include({
          entered: false
        });
        expect(state.children.find(c => c.id === 'userTask')).to.include({
          entered: true
        });
        expect(state.children.find(c => c.id === 'theEnd')).to.include({
          entered: false
        });
        done();
      });

      engine.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    lab.test('returns state of task in loop', (done) => {
      const loopProcessXml = `
<bpmn:definitions id= "Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:userTask id="recurring" name="Each item">
      <bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.list}">
        <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">7</bpmn:loopCardinality>
      </bpmn:multiInstanceLoopCharacteristics>
    </bpmn:userTask>
  </bpmn:process>
</bpmn:definitions>
        `;

      const engine = new Bpmn.Engine({
        source: loopProcessXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      let state;
      let iteration = 0;
      listener.on('wait-recurring', (task, process) => {
        iteration++;

        if (iteration < 2) {
          task.signal();
        } else if (iteration === 2) {
          state = process.getState();
          engine.stop();
        }
      });

      engine.execute({
        listener: listener,
        variables: {
          list: [1, 2, 3, 7]
        }
      }, (err) => {
        if (err) return done(err);
      });

      engine.once('end', () => {
        const childState = state.children.find(c => c.id === 'recurring');
        expect(childState).to.include({
          entered: true,
          loop: {
            isSequential: true,
            iteration: 1,
            characteristics: {
              cardinality: 7,
              type: 'collection'
            }
          }
        });

        done();
      });
    });
  });

});
