'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelper = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('BaseProcess', () => {

  lab.describe('empty process', () => {

    lab.test('emits end', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theEmptyProcess" isExecutable="true" />
  </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          done();
        });
      });
    });
  });

  lab.describe('ad hoc process', () => {

    lab.test('starts all without inbound', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theUncontrolledProcess" isExecutable="true">
      <userTask id="userTask" />
      <scriptTask id="task2" scriptFormat="JavaScript">
        <script>
          <![CDATA[
            this.variables.input = 2;
            next();
          ]]>
        </script>
      </scriptTask>
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err, execution) => {
        if (err) return done(err);

        const userTask = execution.getChildActivityById('userTask');
        userTask.once('wait', () => {
          setTimeout(userTask.signal.bind(userTask, 'von Rosen'), 50);
        });

        execution.on('end', () => {
          expect(execution.getChildActivityById('task2').taken, 'task2 taken').to.be.true();
          expect(execution.getChildActivityById('userTask').taken, 'userTask taken').to.be.true();

          expect(execution.variables.input).to.equal(2);
          expect(execution.variables.taskInput.userTask).to.equal('von Rosen');

          done();
        });
      });
    });

    lab.test('starts task without inbound and then ends without outbound', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theUncontrolledProcess" isExecutable="true">
      <userTask id="task1" />
      <scriptTask id="task2" scriptFormat="JavaScript">
        <script>
          <![CDATA[
            const self = this;
            function setContextVariable(callback) {
              if (!self.variables.taskInput) {
                return callback(new Error('Missing task input'));
              }

              self.variables.userWrote = self.variables.taskInput.task1;
              callback();
            }
            setContextVariable(next);
          ]]>
        </script>
      </scriptTask>
      <sequenceFlow id="flow1" sourceRef="task1" targetRef="task2" />
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute((err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.getChildActivityById('task1').taken).to.be.true();
          expect(execution.getChildActivityById('task2').taken).to.be.true();

          expect(execution.variables.taskInput.task1).to.equal('von Rosen');
          expect(execution.variables.userWrote).to.equal('von Rosen');

          done();
        });

        const userTask = execution.getChildActivityById('task1');
        userTask.once('wait', () => userTask.signal('von Rosen'));
      });
    });
  });

  lab.describe('loop', () => {
    lab.test('completes process', (done) => {
      const processXml = factory.resource('loop.bpmn');

      const listener = new EventEmitter();
      let startCount = 0;
      let endCount = 0;
      let leaveCount = 0;
      listener.on('start-scriptTask1', () => {
        startCount++;
      });
      listener.on('end-theEnd', () => {
        endCount++;
      });
      listener.on('leave-scriptTask2', () => {
        leaveCount++;
        if (leaveCount > 3) {
          done(new Error('Infinite loop'));
        }
      });

      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 0
        },
        listener: listener
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(startCount, 'scriptTask1 starts').to.equal(3);
          expect(instance.variables.input).to.equal(2);

          expect(instance.getChildActivityById('theEnd').taken).to.be.true();

          expect(endCount, 'theEnd count').to.equal(1);

          testHelper.expectNoLingeringListeners(instance);
          done();
        });
      });
    });
  });

  lab.describe('multiple end events', () => {
    const processXml = factory.resource('multiple-endEvents.bpmn');
    lab.test('completes all flows', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });
      engine.execute({
        variables: {
          input: 0
        }
      }, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(execution.variables.input, 'iterated input').to.equal(2);
          done();
        });
      });
    });
  });

  lab.describe('boundary timeout event', () => {
    const processXml = factory.resource('boundary-timeout.bpmn');

    lab.test('timer boundary event with cancel task completes', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });

      const listener = new EventEmitter();
      listener.once('end-userTask', (e) => {
        Code.fail(`<${e.id}> should not have reached end`);
      });

      engine.execute({
        variables: {
          input: 0
        }
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          testHelper.expectNoLingeringListeners(execution);
          done();
        });
      });
    });

    lab.test('timer boundary event is discarded if task completes', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml
      });

      const listener = new EventEmitter();
      listener.on('wait-userTask', (activity) => {
        activity.signal({
          input: 1
        });
      });

      listener.once('end-boundTimeoutEvent', (e) => {
        Code.fail(`<${e.id}> should not have reached end`);
      });

      engine.execute({
        listener: listener,
        variables: {
          input: 0
        }
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          testHelper.expectNoLingeringListeners(execution);
          done();
        });
      });
    });
  });

  lab.describe('#run', () => {

    let instance;
    lab.before((done) => {
      const processXml = factory.resource('mother-of-all.bpmn');
      const engine = new Bpmn.Engine({
        source: processXml
      });
      const listener = new EventEmitter();
      listener.on('wait', (activity) => {
        activity.signal({
          input: 1
        });
      });

      engine.getInstance({
        services: {
          runService: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn',
            type: 'require'
          }
        },
        variables: {
          input: 0
        },
        listener: listener
      }, (err, inst) => {
        if (err) return done(err);
        instance = inst;
        done();
      });
    });

    lab.test('completes', (done) => {
      instance.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });
      instance.run();
    });

    lab.test('completes twice', (done) => {
      instance.once('end', () => {
        testHelper.expectNoLingeringListeners(instance);
        done();
      });
      instance.run();
    });
  });
});
