'use strict';

const Code = require('code');
const Lab = require('lab');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('UserTask', () => {
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

    lab.test('process emits wait when entering user task', (done) => {
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();

      listener.on('wait', (activity, execution) => {
        if (activity.type !== 'bpmn:UserTask') return;

        execution.signal(activity.id, {
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

    lab.test('ends when signal is called', (done) => {

      const engine = new Bpmn.Engine(alternativeProcessXml);
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity) => {
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

      listener.once('wait-userTask', (task, execution) => {
        execution.signal('userTask');
      });

      engine.startInstance(null, listener, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          done();
        });
      });
    });

    lab.test('completes if canceled', (done) => {
      const engine = new Bpmn.Engine(alternativeProcessXml);
      const listener = new EventEmitter();

      listener.once('wait-userTask', (task) => {
        task.cancel();
      });

      engine.startInstance(null, listener, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.getChildActivityById('userTask').canceled).to.be.true();
          done();
        });
      });
    });
  });

  lab.experiment('#signal', () => {
    lab.test('user input is stored with process', (done) => {
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity, execution) => {
        execution.signal('userTask', {
          myName: 'Pål'
        });
      });

      engine.startInstance(null, listener, (err, execution) => {
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
      const engine = new Bpmn.Engine(processXml);
      const listener = new EventEmitter();

      listener.once('wait-userTask', (activity, execution) => {
        execution.signal('userTask');
      });

      engine.startInstance(null, listener, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables).to.not.include('inputFromUser');
          done();
        });
      });
    });

    lab.test('throws if not waiting for input', (done) => {
      const engine = new Bpmn.Engine(processXml);

      engine.getInstance(null, null, (err, instance) => {
        if (err) return done(err);

        const task = instance.getChildActivityById('userTask');

        expect(task.signal.bind(task)).to.throw(Error);
        done();
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

      listener.once('wait', (activity, execution) => {
        if (activity.type !== 'bpmn:UserTask') return;

        execution.signal(activity.id, {
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

      listener.once('wait-userTask', (activity, execution) => {
        execution.signal('userTask');
      });

      engine.startInstance({
        taskInput: {}
      }, listener, (err, execution) => {
        if (err) return done(err);

        execution.once('end', () => {
          expect(execution.variables.taskInput).to.be.empty();
          done();
        });
      });
    });
  });
});
