'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('SubProcess', () => {
  describe('events', () => {
    const source = factory.resource('sub-process.bpmn').toString();
    let context;

    beforeEach((done) => {
      testHelpers.getContext(source, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('emits start on inbound taken', (done) => {
      const subProcess = context.getChildActivityById('subProcess');
      subProcess.activate();

      subProcess.once('start', () => {
        done();
      });

      subProcess.inbound[0].take();
    });

    it('emits end on completed', (done) => {
      const listener = new EventEmitter();
      context.environment.setListener(listener);

      const subProcess = context.getChildActivityById('subProcess');

      subProcess.activate();

      listener.once('wait-subUserTask', (activityApi) => {
        activityApi.signal();
      });

      subProcess.once('end', () => {
        done();
      });

      subProcess.inbound[0].take();
    });

  });

  describe('loop', () => {
    describe('sequential', () => {
      let context;
      beforeEach((done) => {
        getLoopContext(true, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      it('emits start with the same id', (done) => {
        const task = context.getChildActivityById('sub-process-task');
        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });
        task.once('end', () => {
          expect(starts).to.be.equal(['sub-process-task', 'sub-process-task', 'sub-process-task']);
          done();
        });

        task.run();
      });

      it('assigns input', (done) => {
        const listener = new EventEmitter();
        context.environment.setListener(listener);

        const task = context.getChildActivityById('sub-process-task');
        const taskApi = task.activate(null, listener);

        const doneTasks = [];
        listener.on('start-serviceTask', (activityApi) => {
          doneTasks.push(activityApi.getInput().input);
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['sub labour', 'sub archiving', 'sub shopping']);
          done();
        });

        taskApi.run();
      });

    });

    describe('parallell', () => {
      let context;
      beforeEach((done) => {
        getLoopContext(false, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      it('emits start with different ids', (done) => {
        const task = context.getChildActivityById('sub-process-task');

        const starts = [];
        task.on('start', (activityApi, executionContext) => {
          starts.push(executionContext.id);
        });

        task.once('end', () => {
          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      it('assigns input to form', (done) => {
        const listener = new EventEmitter();
        context.environment.setListener(listener);

        const task = context.getChildActivityById('sub-process-task');
        const taskApi = task.activate();

        const doneTasks = [];
        listener.on('end', (activity) => {
          doneTasks.push(activity.getInput().input);
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['sub labour', 'sub archiving', 'sub shopping']);
          done();
        });

        taskApi.run();
      });
    });
  });

  describe('engine', () => {
    const source = factory.resource('sub-process.bpmn').toString();

    it('completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (activityApi) => {
        activityApi.signal();
      });

      const engine = new Engine({
        source
      });
      engine.execute({
        listener,
        variables: {
          input: 1
        }
      }, (err, definition) => {
        if (err) return done(err);
        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
          done();
        });
      });
    });

    it('cancel sub process takes all outbound and completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (taskApi, subProcessInstance) => {
        subProcessInstance.cancel();
      });

      const engine = new Engine({
        source
      });
      engine.execute({
        listener,
        variables: {
          input: 0
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildState('theEnd').taken, 'theEnd taken').to.be.true();
          expect(definition.getChildState('subProcess').cancelled, 'subProcess canceled').to.be.true();

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
          done();
        });
      });
    });

    it('cancelled sub activity takes all outbound and completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.once('wait-subUserTask', (activityApi) => {
        activityApi.signal();
      });
      listener.once('start-subScriptTask', (activityApi) => {
        activityApi.cancel();
      });

      const engine = new Engine({
        source
      });
      engine.execute({
        listener,
        variables: {
          input: 127
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildState('theEnd').taken, 'theEnd taken').to.be.true();
          expect(definition.getChildState('subProcess').cancelled, 'subProcess canceled').to.be.undefined();
          expect(definition.getChildState('subProcess').taken, 'subProcess taken').to.be.true();

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
          done();
        });
      });
    });
  });

  describe('error', () => {
    it('emits error if sub task fails', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
            targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="mainProcess" isExecutable="true">
          <subProcess id="subProcess" name="Wrapped">
            <serviceTask id="subServiceTask" name="Put" camunda:expression="\${services.throw}" />
          </subProcess>
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      engine.execute({
        services: {
          throw: (context, next) => {
            next(new Error('Expected'));
          }
        }
      }, (err) => {
        if (err) return done(err);
      });

      engine.on('error', (thrownErr) => {
        expect(thrownErr).to.be.an.error('Expected');
        done();
      });
    });

    it('catches error if bound error event is attached', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
            targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="mainProcess" isExecutable="true">
          <subProcess id="subProcess" name="Wrapped">
            <serviceTask id="subServiceTask" name="Put" camunda:expression="\${services.throw}" />
          </subProcess>
          <boundaryEvent id="errorEvent" attachedToRef="subProcess">
            <errorEventDefinition errorRef="Error_def" camunda:errorCodeVariable="serviceError" camunda:errorMessageVariable="message" />
          </boundaryEvent>
        </process>
        <error id="Error_def" name="SubProcessError" errorCode="\${message}" />
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      engine.execute({
        services: {
          throw: (context, next) => {
            next(new Error('Expected'));
          }
        }
      }, (err) => {
        if (err) return done(err);
      });

      engine.on('end', (def) => {
        expect(def.getOutput()).to.equal({
          taskInput: {
            errorEvent: {
              serviceError: 'Expected',
              message: 'Expected'
            }
          }
        });
        done();
      });
    });
  });

  describe('IO', () => {
    it('transfers input to context variables', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions id="Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
            targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="mainProcess" isExecutable="true">
          <bpmn:subProcess id="subProcess" name="Wrapped">
            <bpmn:extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="api">\${variables.apiPath}</camunda:inputParameter>
                <camunda:inputParameter name="serviceFn">\${services.put}</camunda:inputParameter>
                <camunda:outputParameter name="result">\${variables.result}</camunda:outputParameter>
              </camunda:inputOutput>
            </bpmn:extensionElements>
            <bpmn:serviceTask id="subServiceTask" name="Put" camunda:expression="\${serviceFn()}">
              <bpmn:extensionElements>
                <camunda:inputOutput>
                  <camunda:inputParameter name="uri">\${variables.api}</camunda:inputParameter>
                  <camunda:outputParameter name="result">\${result[0]}</camunda:outputParameter>
                </camunda:inputOutput>
              </bpmn:extensionElements>
            </bpmn:serviceTask>
          </bpmn:subProcess>
        </bpmn:process>
      </bpmn:definitions>`;

      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      engine.execute({
        services: {
          put: () => {
            return (uri, next) => {
              next(null, 1);
            };
          }
        },
        variables: {
          apiPath: 'https://api.example.com/v1'
        }
      });

      engine.once('end', (def) => {
        expect(def.getOutput()).to.equal({
          apiPath: 'https://api.example.com/v1',
          result: 1
        });
        done();
      });
    });
  });
});

function getLoopContext(sequential, callback) {
  const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="sequentialLoopProcess" isExecutable="true">
    <subProcess id="sub-process-task" name="Wrapped">
      <multiInstanceLoopCharacteristics isSequential="${sequential}" camunda:collection="\${variables.inputList}">
        <loopCardinality>5</loopCardinality>
      </multiInstanceLoopCharacteristics>

      <serviceTask id="serviceTask" name="Put" camunda:expression="\${services.loop}">
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="input">\${variables.prefix} \${item}</camunda:inputParameter>
            <camunda:outputParameter name="result">\${result[0]}</camunda:outputParameter>
          </camunda:inputOutput>
        </extensionElements>
      </serviceTask>
    </subProcess>
    </process>
  </definitions>`;
  testHelpers.getContext(processXml, {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }, (err, context) => {
    if (err) return callback(err);
    context.environment.assignResult({
      prefix: 'sub',
      inputList: ['labour', 'archiving', 'shopping']
    });

    context.environment.services.loop = (input, next) => {
      next(null, input);
    };

    callback(null, context);
  });
}
