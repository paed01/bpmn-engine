'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const Process = require('../../lib/activities/Process');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('SubProcess', () => {
  lab.describe('events', () => {
    const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true">
          <task id="vips" />
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

    lab.test('emits start when executed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext);

      mainProcess.once('start', () => {
        done();
      });

      mainProcess.run();
    });

    lab.test('emits end on completed', (done) => {
      const mainProcess = new Process(moddleContext.elementsById.tinyProcess, moddleContext);

      mainProcess.once('end', () => {
        done();
      });

      mainProcess.run();
    });

  });
});
