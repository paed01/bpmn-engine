'use strict';

const Environment = require('../../lib/Environment');
const factory = require('../helpers/factory');
const Lab = require('lab');
const Process = require('../../lib/process');
const testHelpers = require('../helpers/testHelpers');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('Process', () => {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="tinyProcess" isExecutable="true">
      <task id="vips" />
    </process>
    <process id="waitProcess" isExecutable="true">
      <userTask id="usertask" />
    </process>
    <process id="processWithTaskOutput" isExecutable="true">
      <dataObjectReference id="inputRef" dataObjectRef="input" />
      <dataObjectReference id="outputRef" dataObjectRef="output" />
      <dataObject id="output" />
      <dataObject id="input" />
      <task id="task">
        <dataInputAssociation id="associatedInputWith" sourceRef="taskInput" targetRef="inputRef" />
        <ioSpecification id="inputSpec">
          <dataInput id="taskInput" name="hello" />
          <dataOutput id="taskOutput" name="bye" />
        </ioSpecification>
        <dataOutputAssociation id="associatedOutputWith" sourceRef="taskOutput" targetRef="outputRef" />
      </task>
    </process>
    <process id="theEmptyProcess" isExecutable="true" />
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

  let moddleContext;
  beforeEach(async () => {
    moddleContext = await testHelpers.moddleContext(source);
  });

  describe('behaviour', () => {
    it('emits start when executed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, new Environment());

      mainProcess.once('start', () => {
        done();
      });

      mainProcess.run();
    });

    it('emits start with process execution argument', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, new Environment());

      mainProcess.once('start', (p, execution) => {
        expect(mainProcess.id).to.equal(execution.id);
        expect(execution.signal).to.be.a.function();
        done();
      });

      mainProcess.run();
    });

    it('emits end when completed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, new Environment());

      mainProcess.once('end', () => {
        done();
      });

      mainProcess.run();
    });

    it('calls callback when completed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, new Environment());
      mainProcess.activate().execute(done);
    });

    it('can be ran twice', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, new Environment());

      let count = 0;

      mainProcess.once('end', () => {
        mainProcess.once('end', () => {
          expect(count).to.equal(2);
          done();
        });
        mainProcess.run();
      });

      mainProcess.on('start', () => ++count);

      mainProcess.run();
    });

    it('empty process emits start and end', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.theEmptyProcess, moddleContext, new Environment());
      let started = false;
      mainProcess.on('start', () => {
        started = true;
      });
      mainProcess.on('end', () => {
        expect(started).to.be.true();
        done();
      });
      mainProcess.run();
    });

    it('ad hoc process starts all without inbound', (done) => {
      const mainProcess = Process(moddleContext.elementsById.theUncontrolledProcess, moddleContext);
      const userTask = mainProcess.getChildActivityById('userTask');
      userTask.once('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        setTimeout(api.signal.bind(userTask, 'von Rosen'), 50);
      });

      mainProcess.once('end', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);

        expect(api.getChildState('task2').taken, 'task2 taken').to.be.true();
        expect(api.getChildState('userTask').taken, 'userTask taken').to.be.true();

        expect(api.getOutput().taskInput.userTask).to.equal('von Rosen');
        expect(mainProcess.environment.variables.input).to.equal(2);

        done();
      });
      mainProcess.run();
    });

    it('starts task without inbound and then ends without outbound', (done) => {
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

      testHelpers.getModdleContext(processXml, (cerr, mc) => {
        if (cerr) return done(cerr);
        const mainProcess = Process(mc.elementsById.theUncontrolledProcess, mc);
        const userTask = mainProcess.getChildActivityById('task1');
        userTask.once('wait', (activityApi, executionContext) => executionContext.signal('von Rosen'));

        mainProcess.once('end', (activityApi, executionContext) => {
          const api = activityApi.getApi(executionContext);
          expect(api.getChildState('task1').taken).to.be.true();
          expect(api.getChildState('task2').taken).to.be.true();

          expect(api.getOutput().taskInput.task1).to.equal('von Rosen');
          expect(mainProcess.environment.variables.userWrote).to.equal('von Rosen');

          done();
        });
        mainProcess.run();
      });
    });

    it('multiple end events completes all flows', (done) => {
      testHelpers.getModdleContext(factory.resource('multiple-endEvents.bpmn').toString(), (cerr, mc) => {
        if (cerr) return done(cerr);

        const mainProcess = Process(mc.elementsById.multipleEndProcess, mc, new Environment({
          variables: {
            input: 0
          }
        }));

        mainProcess.once('end', (activityApi, executionContext) => {
          const api = activityApi.getApi(executionContext);
          expect(api.getChildState('script1').taken).to.be.true();
          expect(api.getChildState('script2').taken).to.be.true();

          expect(mainProcess.environment.variables.input, 'iterated input').to.equal(2);

          done();
        });
        mainProcess.run();
      });
    });
  });

  describe('io', () => {
    it('returns variables and services on getInput()', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, new Environment({
        variables: {
          input: 1
        }
      }));

      mainProcess.once('start', (p, executionContext) => {
        expect(executionContext.getInput()).to.include({
          variables: {
            input: 1
          },
          services: {}
        });
        done();
      });

      mainProcess.run();
    });

    it('assigns task input to variables taskInput on task id', (done) => {
      const listener = new EventEmitter();
      const mainProcess = new Process(moddleContext.elementsById.waitProcess, moddleContext, Environment({
        listener,
        variables: {
          input: 1
        }
      }));

      listener.once('wait', (t) => {
        t.signal({done: true});
      });

      mainProcess.once('end', (p, executionContext) => {
        expect(executionContext.getOutput()).to.equal({
          taskInput: {
            usertask: {done: true}
          }
        });
        done();
      });

      mainProcess.run();
    });

    it('assigns task input to variables if task has output', (done) => {
      const mainProcess = Process(moddleContext.elementsById.processWithTaskOutput, moddleContext, Environment({
        variables: {
          input: 1
        }
      }));

      const task = mainProcess.getChildActivityById('task');
      task.on('start', (activityApi, executionContext) => {
        executionContext.setOutputValue('bye', 'Input was 1');
      });

      mainProcess.once('end', (p, executionContext) => {
        expect(executionContext.getOutput()).to.equal({
          output: 'Input was 1'
        });
        done();
      });

      mainProcess.run();
    });
  });

  describe('getState()', () => {
    it('returns state of processes activities', (done) => {
      const listener = new EventEmitter();
      const mainProcess = new Process(moddleContext.elementsById.theUncontrolledProcess, moddleContext, Environment({
        listener
      }));

      listener.on('wait-userTask', (activityApi, processExecution) => {
        const state = processExecution.getState();
        expect(state.id).to.equal('theUncontrolledProcess');
        expect(state.entered).to.be.true();
        expect(state, 'tasks').to.include(['children', 'environment']);
        expect(state.children.find(c => c.id === 'userTask')).to.include({
          entered: true
        });
        expect(state.children.find(c => c.id === 'task2').entered).to.be.undefined();
        done();
      });

      mainProcess.run();
    });
  });
});
