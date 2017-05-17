'use strict';

const BaseProcess = require('../../lib/mapper').Process;
const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('ReceiveTask', () => {
  const receiveTaskProcessXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <receiveTask id="receive" />
  </process>
</definitions>`;

  lab.experiment('wait', () => {

    lab.test('process emits wait when entering receive task', (done) => {
      testHelpers.getModdleContext(receiveTaskProcessXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const listener = new EventEmitter();
        const instance = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {
          listener: listener,
          variables: {
            input: null
          }
        });

        listener.on('wait-receive', (activity, execution) => {
          execution.signal(activity.id, {
            sirname: 'von Rosen'
          });
        });

        instance.once('end', () => {
          expect(instance.variables.taskInput.receive).to.equal({
            sirname: 'von Rosen'
          });
          done();
        });

        instance.run();
      });
    });

    lab.test('ends when signal is called', (done) => {

      const engine = new Bpmn.Engine({
        source: receiveTaskProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait-receive', (activity) => {
        activity.signal();
      });

      engine.execute({
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          done();
        });
      });
    });

    lab.test('completes if canceled', (done) => {
      const engine = new Bpmn.Engine({
        source: receiveTaskProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait-receive', (task) => {
        task.cancel();
      });

      engine.execute({
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.getChildActivityById('receive').canceled).to.be.true();
          done();
        });
      });
    });
  });
});
