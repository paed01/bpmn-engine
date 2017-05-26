'use strict';

const processExecution = require('../lib/activities/process-execution');
const Code = require('code');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('process execution', () => {
  lab.describe('execute()', () => {
    lab.test('calls callback when completed', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true">
          <task id="vips" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, (cerr, context) => {
        if (cerr) return done(cerr);

        const instance = processExecution(context, () => {}, (err) => {
          if (err) return done(err);

          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });

        instance.execute();
      });
    });

    lab.test('returns error in callback on child error', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="tinyProcess" isExecutable="true">
          <serviceTask id="task" camunda:expression="\${services.fn}" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (cerr, context) => {
        if (cerr) return done(cerr);
        context.services.fn = (arg1, next) => {
          next(new Error('Test err'));
        };

        const instance = processExecution(context, () => {}, (err, source) => {
          expect(err).to.be.an.error('Test err');
          expect(source.id).to.equal('task');
          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });

        instance.execute();
      });
    });

    lab.test('empty process completes immediately', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true" />
      </definitions>`;

      testHelpers.getContext(processXml, (cerr, context) => {
        if (cerr) return done(cerr);

        const instance = processExecution(context, () => {}, (err) => {
          if (err) return done(err);
          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });

        instance.execute();
      });
    });

  });

  lab.describe('signal()', () => {

    lab.test('signals waiting child', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true">
          <userTask id="task" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (cerr, context) => {
        if (cerr) return done(cerr);

        const task = context.getChildActivityById('task');

        const instance = processExecution(context, () => {}, (err, source) => {
          if (err) return done(err);

          expect(source.id).to.equal('task');

          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });

        task.once('wait', () => {
          instance.signal('task');
        });

        instance.execute(() => {
        });
      });
    });
  });
});
