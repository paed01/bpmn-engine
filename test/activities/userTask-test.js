'use strict';

const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('userTask', () => {
  const processXml = factory.userTask();

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const task = execution.getChildActivityById('userTask');
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

    const engine = new Bpmn.Engine(alternativeProcessXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const task = execution.getChildActivityById('userTask');
      expect(task.isEnd).to.be.true();
      done();
    });
  });

  lab.test('should handle user tasks as wait states', (done) => {
    const engine = new Bpmn.Engine(processXml);
    const listener = new EventEmitter();

    listener.once('start-userTask', (activity) => {
      activity.signal();
    });

    engine.startInstance(null, listener, (err, execution) => {
      if (err) return done(err);

      execution.once('end', () => {
        done();
      });
    });
  });

  lab.test('should signal user task by id', (done) => {
    const engine = new Bpmn.Engine(processXml);
    const listener = new EventEmitter();

    engine.startInstance(null, listener, (err, execution) => {
      if (err) return done(err);

      listener.once('start-userTask', () => {
        execution.signal('userTask');
      });

      execution.once('end', () => {
        done();
      });
    });
  });

  lab.test('process emits wait when entering user task', (done) => {
    const engine = new Bpmn.Engine(processXml);
    const listener = new EventEmitter();

    listener.once('wait', (execution, child) => {
      if (child.activity.$type !== 'bpmn:UserTask') return;

      execution.signal(child.activity.id, {
        sirname: 'von Rosen'
      });
    });

    engine.startInstance({
      input: null
    }, listener, (err, execution) => {
      if (err) return done(err);

      execution.once('end', () => {
        expect(execution.variables.inputFromUser).to.equal({
          sirname: 'von Rosen'
        });
        done();
      });
    });
  });

  lab.experiment('user input', () => {
    lab.test('user input is stored with process', (done) => {
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();

      engine.startInstance(null, listener, (err, execution) => {
        if (err) return done(err);

        listener.once('start-userTask', () => {
          execution.signal('userTask', {
            myName: 'Pål'
          });
        });

        execution.once('end', () => {
          expect(execution.variables.inputFromUser).to.equal({
            myName: 'Pål'
          });
          done();
        });
      });
    });

    lab.test('but not if signal is called without input', (done) => {
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();

      engine.startInstance(null, listener, (err, execution) => {
        if (err) return done(err);

        listener.once('start-userTask', () => {
          execution.signal('userTask');
        });

        execution.once('end', () => {
          expect(execution.variables).to.not.include('inputFromUser');
          done();
        });
      });
    });
  });

  lab.experiment('without data association (due to overcomplex data flow in bpmn)', () => {
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
      const engine = new Bpmn.Engine(alternativeProcessXml);
      const listener = new EventEmitter();

      listener.once('wait', (execution, child) => {
        if (child.activity.$type !== 'bpmn:UserTask') return;
        execution.signal(child.activity.id, {
          sirname: 'von Rosen'
        });
      });

      engine.startInstance(null, listener, (err, execution) => {
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
      const engine = new Bpmn.Engine(alternativeProcessXml);
      const listener = new EventEmitter();

      engine.startInstance({
        taskInput: {}
      }, listener, (err, execution) => {
        if (err) return done(err);

        listener.once('start-userTask', () => {
          execution.signal('userTask');
        });

        execution.once('end', () => {
          expect(execution.variables.taskInput).to.be.empty();
          done();
        });
      });
    });
  });

  lab.experiment('cancel', () => {
    lab.test('does not take outgoing sequence flows when completed', (done) => {
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

      const engine = new Bpmn.Engine(alternativeProcessXml);
      engine.startInstance({
        input: 1,
        setTimeout: setTimeout
      }, null, (err, execution) => {
        if (err) return done(err);
        const userTask = execution.getChildActivityById('userTask');
        userTask.once('start', () => {
          execution.terminate();
        });

        execution.once('end', () => {
          expect(execution.getChildActivityById('userTask').taken, 'userTask').to.be.true();
          expect(execution.paths).to.include('flow1');
          expect(execution.paths).to.not.include('flow2');
          done();
        });
      });
    });
  });
});
