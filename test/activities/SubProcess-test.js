'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('SubProcess', () => {
  const processXml = factory.resource('sub-process.bpmn');

  lab.experiment('ctor', () => {
    let parentProcess, subProcess;

    const engine = new Bpmn.Engine(processXml);
    lab.before((done) => {
      engine.getInstance(null, null, (err, instance) => {
        if (err) return done(err);
        parentProcess = instance;
        subProcess = instance.getChildActivityById('subProcess');
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

  lab.experiment('#run', () => {

    lab.test('completes parent process', (done) => {
      const listener = new EventEmitter();
      listener.on('wait-subUserTask', (task) => {
        task.signal();
      });

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 0
      }, listener, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          testHelper.expectNoLingeringListeners(execution);
          testHelper.expectNoLingeringListeners(execution.getChildActivityById('subProcess'));
          done();
        });
      });
    });
  });
});
