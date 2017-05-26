'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('SubProcess', () => {
  lab.describe('events', () => {
    const processXml = factory.resource('sub-process.bpmn').toString();
    let context;

    lab.beforeEach((done) => {
      testHelpers.getContext(processXml, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    lab.test('emits start on inbound taken', (done) => {
      const subProcess = context.getChildActivityById('subProcess');
      subProcess.activate();

      subProcess.once('start', () => {
        done();
      });

      subProcess.inbound[0].take();
    });

    lab.test('emits end on completed', (done) => {
      const subProcess = context.getChildActivityById('subProcess');
      const listener = new EventEmitter();

      subProcess.listener = listener;
      subProcess.activate();

      listener.once('wait', (activity) => {
        activity.signal();
      });

      subProcess.once('end', () => {
        done();
      });

      subProcess.inbound[0].take();
    });

  });

  lab.describe('loop', () => {
    lab.describe('sequential', () => {
      let context;
      lab.beforeEach((done) => {
        getLoopContext(true, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      lab.test('emits start with the same id', (done) => {
        const task = context.getChildActivityById('sub-process-task');
        task.activate();

        const starts = [];
        task.on('start', (activity) => {
          starts.push(activity.id);
        });
        task.once('end', () => {
          expect(starts).to.be.equal(['sub-process-task', 'sub-process-task', 'sub-process-task']);
          done();
        });

        task.run();
      });

      lab.test('assigns input', (done) => {
        const task = context.getChildActivityById('sub-process-task');
        const listener = new EventEmitter();
        task.listener = listener;

        task.activate();

        const doneTasks = [];
        listener.on('start-serviceTask', (activity) => {
          doneTasks.push(activity.getInput().input);
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['sub labour', 'sub archiving', 'sub shopping']);
          done();
        });

        task.run();
      });

    });

    lab.describe('parallell', () => {
      let context;
      lab.beforeEach((done) => {
        getLoopContext(false, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      lab.test('emits start with different ids', (done) => {
        const task = context.getChildActivityById('sub-process-task');

        task.activate();

        const starts = [];
        task.on('start', (activity) => {
          starts.push(activity.id);
        });

        task.once('end', () => {
          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      lab.test('assigns input to form', (done) => {
        const task = context.getChildActivityById('sub-process-task');
        const listener = new EventEmitter();
        task.listener = listener;

        task.activate();

        const doneTasks = [];
        listener.on('end', (activity) => {
          doneTasks.push(activity.getInput().input);
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['sub labour', 'sub archiving', 'sub shopping']);
          done();
        });

        task.run();
      });
    });
  });

  lab.describe('run()', () => {
    const processXml = factory.resource('sub-process.bpmn').toString();

    lab.test('completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (task) => {
        task.signal();
      });

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        listener: listener,
        variables: {
          input: 1
        }
      }, (err, definition) => {
        if (err) return done(err);
        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));

          const subProcess = definition.getChildActivityById('subProcess');
          expect(subProcess.variables).to.only.include({
            input: 1,
            subScript: true
          });

          done();
        });
      });
    });
  });

  lab.describe('cancel()', () => {
    lab.test('takes all outbound and completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (task, subProcessInstance) => {
        subProcessInstance.cancel();
      });

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        listener: listener,
        variables: {
          input: 0
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildActivityById('theEnd').taken, 'theEnd taken').to.be.true();
          expect(definition.getChildActivityById('subProcess').canceled, 'subProcess canceled').to.be.true();

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
          done();
        });
      });
    });
  });

  lab.describe('cancel sub activity', () => {

    lab.test('takes all outbound and completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.once('wait-subUserTask', (task) => {
        task.signal();
      });
      listener.once('start-subScriptTask', (task) => {
        task.cancel();
      });

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        listener: listener,
        variables: {
          input: 127
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildActivityById('theEnd').taken, 'theEnd taken').to.be.true();
          expect(definition.getChildActivityById('subProcess').canceled, 'subProcess canceled').to.be.false();

          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          testHelpers.expectNoLingeringListeners(definition.getChildActivityById('subProcess'));
          done();
        });
      });
    });
  });

  lab.describe('IO', () => {

    lab.test('transfers input to context variables', (done) => {
      const ioXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions id="Definitions_1" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
            targetNamespace="http://bpmn.io/schema/bpmn">
        <bpmn:process id="mainProcess" isExecutable="true">
          <bpmn:subProcess id="subProcess" name="Wrapped">
            <bpmn:extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="api">\${variables.apiPath}</camunda:inputParameter>
                <camunda:outputParameter name="result"></camunda:outputParameter>
              </camunda:inputOutput>
            </bpmn:extensionElements>
            <bpmn:serviceTask id="subServiceTask" name="Put" camunda:expression="\${services.put()}">
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

      const engine = new Bpmn.Engine({
        source: ioXml,
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
      }, (err, instance) => {
        if (err) return done(err);

        instance.once('end', () => {
          expect(instance.variables).to.equal({
            apiPath: 'https://api.example.com/v1',
            result: 1
          });
          done();
        });
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
    context.variablesAndServices.variables = {
      prefix: 'sub',
      inputList: ['labour', 'archiving', 'shopping']
    };

    context.variablesAndServices.services.loop = (input, next) => {
      next(null, input);
    };

    callback(null, context);
  });
}
