'use strict';

const Code = require('code');
const Lab = require('lab');
const Process = require('../../lib/activities/Process');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('Process', () => {
  const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="tinyProcess" isExecutable="true">
      <task id="vips" />
    </process>
    <process id="waitProcess" isExecutable="true">
      <userTask id="task" />
    </process>
  </definitions>`;
  let moddleContext;

  lab.beforeEach((done) => {
    testHelpers.getModdleContext(processXml, (err, result) => {
      if (err) return done(err);
      moddleContext = result;
      done();
    });
  });

  lab.describe('events', () => {
    lab.test('emits start when executed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext);

      mainProcess.once('start', () => {
        done();
      });

      mainProcess.run();
    });

    lab.test('emits start with process execution argument', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext);

      mainProcess.once('start', (p, execution) => {
        expect(mainProcess.id).to.equal(execution.id);
        expect(execution.signal).to.be.a.function();
        done();
      });

      mainProcess.run();
    });

    lab.test('emits end when completed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext);

      mainProcess.once('end', () => {
        done();
      });

      mainProcess.run();
    });

  });

  lab.describe('variables', () => {
    lab.test('returns variables on getInput()', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext, {
        variables: {
          input: 1
        }
      });

      mainProcess.once('start', (p, executionContext) => {
        expect(executionContext.getInput()).to.include({
          variables: {
            input: 1
          }
        });
        done();
      });

      mainProcess.run();
    });
  });
});
