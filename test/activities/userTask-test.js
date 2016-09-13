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

  lab.experiment('wait', () => {
    const alternativeProcessXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="singleTaskProcess" isExecutable="true">
    <userTask id="userTask" />
  </process>
</definitions>`;

    lab.test('ends when signal is called', (done) => {

      const engine = new Bpmn.Engine(alternativeProcessXml);
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

    lab.test('instance can signal user task by id', (done) => {
      const engine = new Bpmn.Engine(alternativeProcessXml);
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

      listener.on('wait', (execution, child) => {
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

  lab.experiment('boundary event', () => {
    lab.test('are attached to the task', (done) => {
      const alternativeProcessXml = factory.resource('timer.bpmn');

      const engine = new Bpmn.Engine(alternativeProcessXml);
      engine.getInstance(null, null, (err, instance) => {
        if (err) return done(err);

        const timeoutTask = instance.getChildActivityById('userTask');
        expect(timeoutTask.inbound.length, 'Attached inbound flows').to.equal(1);
        expect(timeoutTask.outbound.length, 'Attached outbound flows').to.equal(1);
        expect(timeoutTask.boundEvents.length, 'Attached boundary events').to.equal(1);
        expect(timeoutTask.boundEvents[0].isStart, 'Attached boundary start').to.be.false();
        expect(timeoutTask.boundEvents[0].inbound.length, 'Attached boundary event inbound flows').to.equal(0);
        expect(timeoutTask.boundEvents[0].outbound.length, 'Attached boundary event outbound flows').to.equal(1);
        done();
      });
    });
  });
});
