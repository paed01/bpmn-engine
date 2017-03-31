'use strict';

const Code = require('code');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('ManualTask', () => {
  const manualTaskProcessXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <manualTask id="task" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

  let context;
  lab.beforeEach((done) => {
    testHelpers.getContext(manualTaskProcessXml, (err, result) => {
      if (err) return done(err);
      context = result;
      done();
    });
  });

  lab.describe('events', () => {
    lab.test('emits wait on taken inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', () => {
        done();
      });

      task.inbound[0].take();
    });

    lab.test('leaves on discarded inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', () => {
        Code.fail('No wait should happen');
      });
      task.once('leave', () => {
        done();
      });

      task.inbound[0].discard();
    });
  });

  lab.describe('signal()', () => {
    lab.test('completes when called', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', () => {
        task.signal();
      });
      task.once('end', () => {
        expect(task.taken).to.be.true();
        done();
      });

      task.inbound[0].take();
    });

    lab.test('emits error if signaled if not waiting', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('error', () => {
        done();
      });
      task.signal();
    });
  });
});
