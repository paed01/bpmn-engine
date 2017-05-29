'use strict';

const BaseProcess = require('../../lib/mapper').Process;
const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('UserTask', () => {
  lab.describe('properties', () => {
    let context;
    lab.beforeEach((done) => {
      testHelpers.getContext(factory.userTask('userTask'), (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    lab.test('should have inbound and outbound sequence flows', (done) => {
      const task = context.getChildActivityById('userTask');
      expect(task).to.include('inbound');
      expect(task.inbound).to.have.length(1);
      expect(task).to.include('outbound');
      expect(task.outbound).to.have.length(1);
      done();
    });

    lab.test('is considered end if without outbound sequenceFlows', (done) => {
      const alternativeProcessXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
      <userTask id="userTask" />
    </process>
  </definitions>`;

      testHelpers.getContext(alternativeProcessXml, (cerr, context1) => {
        if (cerr) return done(cerr);
        const task = context1.getChildActivityById('userTask');
        expect(task.isEnd).to.be.true();
        done();
      });
    });

    lab.test('is considered start if without inbound sequenceFlows', (done) => {
      const alternativeProcessXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
      <userTask id="userTask" />
    </process>
  </definitions>`;

      testHelpers.getContext(alternativeProcessXml, (cerr, context1) => {
        if (cerr) return done(cerr);
        const task = context1.getChildActivityById('userTask');
        expect(task.isStart).to.be.true();
        done();
      });
    });
  });

  lab.describe('events', () => {
    let context;
    lab.beforeEach((done) => {
      testHelpers.getContext(factory.userTask('userTask'), (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    lab.test('emits start when inbound taken', (done) => {
      const task = context.getChildActivityById('userTask');

      task.activate();
      task.once('start', (activity) => {
        expect(activity.id).to.equal('userTask');
        done();
      });

      task.inbound[0].take();
    });

    lab.test('emits wait after start when inbound taken', (done) => {
      const task = context.getChildActivityById('userTask');

      task.activate();

      const eventNames = [];
      task.once('start', () => {
        eventNames.push('start');
      });
      task.once('wait', (activity) => {
        expect(activity.id).to.equal('userTask');
        expect(eventNames).to.equal(['start']);
        done();
      });

      task.inbound[0].take();
    });

    lab.test('wait argument has signal() and cancel()', (done) => {
      const task = context.getChildActivityById('userTask');

      task.activate();

      task.once('wait', (activity) => {
        expect(activity.signal).to.be.a.function();
        expect(activity.cancel).to.be.a.function();
        done();
      });

      task.inbound[0].take();
    });

    lab.test('leaves when signal() is called', (done) => {
      const task = context.getChildActivityById('userTask');

      task.activate();

      task.once('wait', (activity) => {
        activity.signal();
      });
      task.once('leave', () => {
        done();
      });

      task.inbound[0].take();
    });
  });

  lab.experiment('signal()', () => {
    lab.test('user input is stored with process', (done) => {

      const engine = new Bpmn.Engine({
        source: factory.userTask()
      });
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity, execution) => {
        execution.signal('userTask', {
          myName: 'Pål'
        });
      });

      engine.execute({
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables.inputFromUser).to.equal({
            myName: 'Pål'
          });
          done();
        });
      });
    });

    lab.test('but not if signal is called without input', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.userTask()
      });
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity, execution) => {
        execution.signal('userTask');
      });

      engine.execute({
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables).to.not.include('inputFromUser');
          done();
        });
      });
    });

    lab.test.skip('throws if not waiting for input', (done) => {
      testHelpers.getModdleContext(factory.userTask(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('userTask');

        expect(task.signal.bind(task)).to.throw(Error);
        done();
      });
    });

    lab.test.skip('emits error if not waiting for input', (done) => {
      testHelpers.getModdleContext(factory.userTask(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('userTask');

        task.once('error', (err, errTask) => {
          expect(errTask.id).to.equal('userTask');
          expect(err).to.be.an.error(/not waiting/);
          done();
        });

        task.signal.call(task);
      });
    });

  });

  lab.describe('without data association', () => {
    const alternativeProcessXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <userTask id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

    lab.test('the input is stored as taskInput with id', (done) => {
      const engine = new Bpmn.Engine({
        source: alternativeProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait', (activity, execution) => {
        if (activity.type !== 'bpmn:UserTask') return;

        execution.signal(activity.id, {
          sirname: 'von Rosen'
        });
      });

      engine.execute({
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables).to.include('taskInput');
          expect(execution.variables.taskInput).to.include('userTask');
          expect(execution.variables.taskInput.userTask).to.equal({
            sirname: 'von Rosen'
          });
          done();
        });
      });
    });

    lab.test('but not if signal is called without input', (done) => {
      const engine = new Bpmn.Engine({
        source: alternativeProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity, execution) => {
        execution.signal('userTask');
      });

      engine.execute({
        listener: listener,
        variables: {
          taskInput: {}
        }
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables.taskInput).to.be.empty();
          done();
        });
      });
    });
  });

  lab.describe('with form', () => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <userTask id="task">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="formfield1" label="FormField1" type="string" />
          <camunda:formField id="formfield2" type="long" />
        </camunda:formData>
      </extensionElements>
      </userTask>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

    lab.test('requires signal to complete', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-task', (task) => {
        expect(task.waiting).to.be.true();
        task.signal({
          formfield1: 1,
          formfield2: 2
        });
      });

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        listener: listener
      });
    });

    lab.test('getState() returns waiting true', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-task', (event) => {
        engine.stop();
        expect(event.getState()).to.include({ waiting: true });
        done();
      });


      engine.execute({
        listener: listener
      });
    });

    lab.test('getState() returns form state', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-task', (event) => {
        engine.stop();
        const state = event.getState();
        expect(state).to.include(['form']);
        expect(state.form).to.include(['fields']);
        done();
      });

      engine.execute({
        listener: listener
      });
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
          expect(output.taskInput.task).to.be.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      lab.test('assigns input to form', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('wait', (activity) => {
          const input = activity.getInput();
          const answer = {
            email: input.email
          };
          answer[activity.form.getFields()[0].id] = input.index < 2;

          activity.signal(answer);
        });

        task.once('end', (t, output) => {
          expect(output.taskInput.task).to.be.equal([{
            email: 'pal@example.com',
            yay0: true
          }, {
            email: 'franz@example.com',
            yay1: true
          }, {
            email: 'immanuel@example.com',
            yay2: false
          }]);
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
            starts.reverse().forEach((t) => t.signal(activity.id));
          }
        });
        task.once('end', (t, output) => {
          expect(output.taskInput.task.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      lab.test('assigns input to form', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('wait', (activity) => {
          const input = activity.getInput();
          const answer = {
            email: input.email
          };
          answer[activity.form.getFields()[0].id] = input.index < 2;

          activity.signal(answer);
        });

        task.once('end', (t, output) => {
          expect(output.taskInput.task).to.be.equal([{
            email: 'pal@example.com',
            yay0: true
          }, {
            email: 'franz@example.com',
            yay1: true
          }, {
            email: 'immanuel@example.com',
            yay2: false
          }]);
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
    <process id="parallellLoopProcess" isExecutable="true">
      <userTask id="task">
        <multiInstanceLoopCharacteristics isSequential="${sequential}" camunda:collection="\${variables.boardMembers}">
          <loopCardinality>5</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="email">\${item}</camunda:inputParameter>
            <camunda:inputParameter name="index">\${index}</camunda:inputParameter>
          </camunda:inputOutput>
          <camunda:formData>
            <camunda:formField id="yay\${index}" type="boolean" />
          </camunda:formData>
        </extensionElements>
      </userTask>
    </process>
  </definitions>`;
  testHelpers.getContext(processXml, {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }, (err, context) => {
    if (err) return callback(err);
    context.variablesAndServices.variables.boardMembers = ['pal@example.com', 'franz@example.com', 'immanuel@example.com'];
    callback(null, context);
  });
}
