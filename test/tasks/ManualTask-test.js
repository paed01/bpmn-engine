'use strict';

const Code = require('code');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('ManualTask', () => {
  lab.describe('events', () => {
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

    lab.test('completes when called', (done) => {
      const task = context.getChildActivityById('task');
      task.activate();
      task.once('wait', (activity) => {
        activity.signal();
      });
      task.once('end', () => {
        expect(task.taken).to.be.true();
        done();
      });

      task.inbound[0].take();
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

      lab.test('emits wait with the same id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('wait', (activity) => {
          activity.signal(activity.id);
        });
        task.once('end', (t, output) => {
          expect(output).to.be.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      lab.test('assigns input', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const doneTasks = [];
        task.on('wait', (activity) => {
          doneTasks.push(activity.getInput().do);
          activity.signal();
        });

        task.once('end', () => {
          expect(doneTasks).to.equal(['labour', 'archiving', 'shopping']);
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

      lab.test('emits wait with different ids', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('wait', (activity) => {
          starts.push(activity);
          if (starts.length === 3) {
            starts.reverse().forEach((t) => t.signal());
          }
        });
        task.once('end', (t, output) => {
          expect(output.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      lab.test('assigns input to form', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        const starts = [];
        task.on('wait', (activity) => {
          starts.push(activity);
          if (starts.length === 3) {
            starts.reverse().forEach((t) => t.signal(t.getInput().index));
          }
        });

        task.once('end', (t, output) => {
          expect(output).to.equal([0, 1, 2]);
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
    context.variables.analogue = ['labour', 'archiving', 'shopping'];
    callback(null, context);
  });
}
