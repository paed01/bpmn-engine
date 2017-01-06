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
      }, (err, mainInstance) => {
        if (err) return done(err);
        mainInstance.once('end', () => {
          testHelpers.expectNoLingeringListeners(mainInstance);
          testHelpers.expectNoLingeringListeners(mainInstance.getChildActivityById('subProcess'));

          const subProcess = mainInstance.getChildActivityById('subProcess');
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
      }, (err, mainInstance) => {
        if (err) return done(err);

        mainInstance.once('end', () => {
          expect(mainInstance.getChildActivityById('theEnd').taken, 'theEnd taken').to.be.true();
          expect(mainInstance.getChildActivityById('subProcess').canceled, 'subProcess canceled').to.be.true();

          testHelpers.expectNoLingeringListeners(mainInstance);
          testHelpers.expectNoLingeringListeners(mainInstance.getChildActivityById('subProcess'));
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
      }, (err, mainInstance) => {
        if (err) return done(err);

        mainInstance.once('end', () => {
          expect(mainInstance.getChildActivityById('theEnd').taken, 'theEnd taken').to.be.true();
          expect(mainInstance.getChildActivityById('subProcess').canceled, 'subProcess canceled').to.be.false();

          testHelpers.expectNoLingeringListeners(mainInstance);
          testHelpers.expectNoLingeringListeners(mainInstance.getChildActivityById('subProcess'));
          done();
        });
      });
    });
  });
});
