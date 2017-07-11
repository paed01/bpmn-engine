'use strict';

const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('ManualTask', () => {
  describe('events', () => {
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
    beforeEach((done) => {
      testHelpers.getContext(manualTaskProcessXml, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('emits wait on taken inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', () => {
        done();
      });

      task.inbound[0].take();
    });

    it('leaves on discarded inbound', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', () => {
        fail('No wait should happen');
      });
      task.once('leave', () => {
        done();
      });

      task.inbound[0].discard();
    });
  });

  describe('signal()', () => {
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
    beforeEach((done) => {
      testHelpers.getContext(manualTaskProcessXml, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('completes when called', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', (activityApi, executionContext) => {
        executionContext.signal();
      });
      task.once('end', (activityApi) => {
        expect(activityApi.getState().taken).to.be.true();
        done();
      });

      task.inbound[0].take();
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

      it('emits wait with the same id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('wait', (activityApi, executionContext) => {
          executionContext.signal(executionContext.id);
        });
        task.once('end', (activityApi, executionContext) => {
          expect(executionContext.getOutput()).to.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      it('assigns input', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const doneTasks = [];
        task.on('wait', (activityApi, executionContext) => {
          doneTasks.push(executionContext.getInput().do);
          activityApi.getApi(executionContext).signal();
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);
          done();
        });

        task.run();
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

      it('emits wait with different ids', (done) => {
        const task = context.getChildActivityById('task');

        const starts = [];
        task.on('wait', (activityApi, executionContext) => {
          starts.push(executionContext);
          if (starts.length === 3) {
            starts.reverse().forEach((t) => t.signal(t.id));
          }
        });
        task.once('end', (activityApi, executionContext) => {
          const output = executionContext.getOutput();
          expect(output).to.have.length(3);
          output.forEach((id) => expect(id).to.match(/^task_/i));
          expect(output.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      it('assigns input', (done) => {
        const task = context.getChildActivityById('task');

        const doneTasks = [];
        task.on('wait', (activityApi, executionContext) => {
          doneTasks.push(executionContext.getInput().do);
          activityApi.getApi(executionContext).signal();
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);
          done();
        });

        task.run();
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
      <manualTask id="task">
        <multiInstanceLoopCharacteristics isSequential="${sequential}" camunda:collection="\${variables.analogue}">
          <loopCardinality>5</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="do">\${item}</camunda:inputParameter>
            <camunda:inputParameter name="index">\${index}</camunda:inputParameter>
          </camunda:inputOutput>
        </extensionElements>
      </manualTask>
    </process>
  </definitions>`;
  testHelpers.getContext(processXml, {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }, (err, context) => {
    if (err) return callback(err);
    context.environment.variables.analogue = ['labour', 'archiving', 'shopping'];
    callback(null, context);
  });
}
