'use strict';

const BaseProcess = require('../../lib/mapper').Process;
const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('BaseTask', () => {

  lab.describe('cancel()', () => {
    lab.test('cancels bound events and takes all outbound', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.resource('boundary-timeout.bpmn')
      });
      const listener = new EventEmitter();
      listener.on('wait-userTask', (activity) => {
        activity.cancel();
      });

      engine.execute({
        listener: listener
      }, (err, definition) => {
        if (err) return done(err);
        definition.once('end', () => {
          expect(definition.getChildActivityById('join').taken, 'join').to.be.true();
          expect(definition.getChildActivityById('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });
  });

  lab.describe('multiple inbounds', () => {
    const processXml = factory.resource('task-multiple-inbound.bpmn');

    lab.test('completes process', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });
      const listener = new EventEmitter();
      listener.on('wait', (activity) => {
        activity.signal({
          input: 1
        });
      });

      let taskCount = 0;
      listener.on('end-script', (a) => {
        taskCount++;
        if (taskCount > 3) {
          Code.fail(`Too many runs for <${a.id}>`);
        }
      });

      engine.execute({
        variables: {
          input: 0
        },
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          done();
        });
      });

    });
  });

  lab.describe('in lane with outbound message', () => {
    lab.test('will have outbound that point to other lane', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn'), (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.mainProcess, moddleContext, {});
        const task = process.getChildActivityById('task1');
        expect(task.outbound).to.have.length(2);
        done();
      });
    });
  });
});
