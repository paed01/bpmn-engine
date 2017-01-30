'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const BaseProcess = require('../../lib/mapper').Process;
const Bpmn = require('../..');

lab.experiment('SubProcess', () => {
  const processXml = factory.resource('sub-process.bpmn');

  lab.describe('ctor', () => {
    let parentProcess, subProcess;

    lab.before((done) => {
      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        parentProcess = new BaseProcess(moddleContext.elementsById.mainProcess, moddleContext, {});
        subProcess = parentProcess.getChildActivityById('subProcess');
        done();
      });
    });

    lab.test('parent process should only initialise its own', (done) => {
      const parentProcessContext = parentProcess.context;
      expect(parentProcessContext.sequenceFlows.length).to.equal(2);
      expect(parentProcessContext.childCount).to.equal(3);
      expect(parentProcessContext.children.subProcess).to.exist();
      expect(parentProcessContext.children.subUserTask).to.not.exist();
      expect(parentProcess.inbound.length, 'inbound').to.equal(0);
      done();
    });

    lab.test('sub process should only initialise its own', (done) => {
      expect(subProcess.inbound.length, 'inbound').to.equal(1);

      const subProcessContext = subProcess.context;
      expect(subProcessContext.sequenceFlows.length, 'sequenceFlows').to.equal(1);
      expect(subProcessContext.childCount).to.equal(2);
      expect(subProcessContext.children.subProcess).to.not.exist();
      expect(subProcessContext.children.subUserTask).to.exist();

      done();
    });

  });

  lab.describe('run()', () => {

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

  lab.describe('input/output', () => {

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
</bpmn:definitions>
      `;

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
