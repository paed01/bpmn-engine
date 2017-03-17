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

  lab.test('should have inbound and outbound sequence flows', (done) => {
    testHelpers.getModdleContext(factory.userTask(), (cerr, moddleContext) => {
      if (cerr) return done(cerr);
      const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
      const task = process.getChildActivityById('userTask');
      expect(task).to.include('inbound');
      expect(task.inbound).to.have.length(1);
      expect(task).to.include('outbound');
      expect(task.outbound).to.have.length(1);
      done();
    });
  });

  lab.test('is considered end if without outbound sequenceFlows', (done) => {
    const alternativeProcessXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <userTask id="userTask" />
  </process>
</definitions>`;

    testHelpers.getModdleContext(alternativeProcessXml, (cerr, moddleContext) => {
      if (cerr) return done(cerr);
      const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
      const task = process.getChildActivityById('userTask');
      expect(task.isEnd).to.be.true();
      done();
    });
  });

  lab.experiment('wait', () => {
    const alternativeProcessXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="singleTaskProcess" isExecutable="true">
    <userTask id="userTask" />
  </process>
</definitions>`;

    lab.test('process emits wait when entering user task', (done) => {
      testHelpers.getModdleContext(factory.userTask(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const listener = new EventEmitter();
        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {
          listener: listener,
          variables: {
            input: null
          }
        });

        listener.on('wait', (activity, execution) => {
          if (activity.type !== 'bpmn:UserTask') return;

          execution.signal(activity.id, {
            sirname: 'von Rosen'
          });
        });

        process.once('end', () => {
          expect(process.variables.inputFromUser).to.equal({
            sirname: 'von Rosen'
          });
          done();
        });

        process.run();
      });
    });

    lab.test('ends when signal is called', (done) => {

      const engine = new Bpmn.Engine({
        source: alternativeProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity) => {
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

    lab.test('instance can signal user task by id', (done) => {
      const engine = new Bpmn.Engine({
        source: alternativeProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait-userTask', (task, execution) => {
        execution.signal('userTask');
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
        source: alternativeProcessXml
      });
      const listener = new EventEmitter();

      listener.once('wait-userTask', (task) => {
        task.cancel();
      });

      engine.execute({
        listener: listener
      }, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.getChildActivityById('userTask').canceled).to.be.true();
          done();
        });
      });
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

    lab.test('throws if not waiting for input', (done) => {
      testHelpers.getModdleContext(factory.userTask(), (cerr, moddleContext) => {
        if (cerr) return done(cerr);

        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('userTask');

        expect(task.signal.bind(task)).to.throw(Error);
        done();
      });
    });

    lab.test('emits error if not waiting for input', (done) => {
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

});
