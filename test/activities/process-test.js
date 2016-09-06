'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('Process', () => {

  lab.experiment('empty', () => {

    lab.test('emits end', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theEmptyProcess" isExecutable="true" />
  </definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          done();
        });
      });
    });
  });

  lab.experiment('without sequenceFlows', () => {

    lab.test('starts all without inbound', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theUncontrolledProcess" isExecutable="true">
      <userTask id="task1" />
      <scriptTask id="task2" scriptFormat="Javascript">
        <script>
          <![CDATA[
            this.context.input = 2;
            next();
          ]]>
        </script>
      </scriptTask>
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);

        const userTask = execution.getChildActivityById('task1');
        userTask.once('start', () => userTask.signal('von Rosen'));

        execution.once('end', () => {
          expect(execution.getChildActivityById('task2').taken).to.be.true();
          expect(execution.getChildActivityById('task1').taken).to.be.true();

          expect(execution.variables.input).to.equal(2);
          expect(execution.variables.taskInput.task1).to.equal('von Rosen');

          done();
        });
      });
    });

    lab.test('starts task without inbound and then ends with without outbound', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theUncontrolledProcess" isExecutable="true">
      <userTask id="task1" />
      <scriptTask id="task2" scriptFormat="Javascript">
        <script>
          <![CDATA[
            this.context.userWrote = this.context.taskInput.task1;
            next();
          ]]>
        </script>
      </scriptTask>
      <sequenceFlow id="flow1" sourceRef="task1" targetRef="task2" />
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);

        const userTask = execution.getChildActivityById('task1');
        userTask.once('start', () => userTask.signal('von Rosen'));

        execution.once('end', () => {
          expect(execution.getChildActivityById('task1').taken).to.be.true();
          expect(execution.getChildActivityById('task2').taken).to.be.true();

          expect(execution.variables.taskInput.task1).to.equal('von Rosen');
          expect(execution.variables.userWrote).to.equal('von Rosen');
          expect(execution.paths).to.include('flow1');

          done();
        });
      });
    });
  });

  lab.experiment('loop', () => {
    lab.test('completes process', (done) => {
      const processXml = factory.resource('loop.bpmn');

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('end-scriptTask1', () => {
        startCount++;
      });

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 1
      }, listener, (err, execution) => {
        if (err) return done(err);
        execution.once('end', () => {
          expect(startCount).to.equal(2);
          done();
        });
      });
    });
  });
});
