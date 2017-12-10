'use strict';

const testHelpers = require('../helpers/testHelpers');

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
    beforeEach(async () => {
      context = await testHelpers.context(manualTaskProcessXml);
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
        expect.fail('No wait should happen');
      });
      task.once('leave', () => {
        done();
      });

      task.inbound[0].discard();
    });
  });

  describe('signal()', () => {
    const source = `
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
      testHelpers.getContext(source, (err, result) => {
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
        expect(activityApi.getState().taken).to.be.true;
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

        const waits = [];
        task.on('wait', (activityApi, executionContext) => {
          if (waits.length > 5) expect.fail('too many waits');
          waits.push(executionContext.id);

          executionContext.signal();
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          expect(waits).to.eql(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      it('signal sets output', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('wait', (activityApi, executionContext) => {
          const {index, variables} = executionContext.getInputContext();
          activityApi.getApi(executionContext).signal(variables.analogue[index]);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          expect(executionContext.getOutput()).to.eql(['labour', 'archiving', 'shopping']);
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
        const waits = [];
        task.on('wait', (activityApi, executionContext) => {
          if (waits.length > 5) expect.fail('too many waits');

          waits.push(executionContext.id);
          starts.push(executionContext);

          if (starts.length === 3) {
            starts.reverse().forEach((t) => t.signal(t.id));
          }
        });
        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;

          expect(waits).to.have.length(3);
          waits.forEach((id) => expect(id).to.match(/^task_/i));
          expect(waits.includes(task.id), 'unique task id').to.be.false;

          done();
        });

        task.run();
      });

      it('signal assigns output', (done) => {
        const task = context.getChildActivityById('task');

        task.on('wait', (activityApi, executionContext) => {
          const {index, variables} = executionContext.getInputContext();
          activityApi.getApi(executionContext).signal(variables.analogue[index]);
        });

        task.on('end', (activityApi, executionContext) => {
          if (executionContext.isLoopContext) return;
          expect(executionContext.getOutput()).to.eql(['labour', 'archiving', 'shopping']);
          done();
        });

        task.run();
      });
    });
  });

});

function getLoopContext(sequential, callback) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="sequentialLoopProcess" isExecutable="true">
      <manualTask id="task">
        <multiInstanceLoopCharacteristics isSequential="${sequential}">
          <loopCardinality>\${variables.analogue.length}</loopCardinality>
        </multiInstanceLoopCharacteristics>
      </manualTask>
    </process>
  </definitions>`;
  testHelpers.getContext(source, (err, context) => {
    if (err) return callback(err);
    context.environment.variables.analogue = ['labour', 'archiving', 'shopping'];
    callback(null, context);
  });
}
