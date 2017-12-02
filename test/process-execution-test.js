'use strict';

const ProcessExecution = require('../lib/process/Execution');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('process execution', () => {
  describe('execute()', () => {
    it('calls callback when completed', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true">
          <task id="vips" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (cerr, context) => {
        if (cerr) return done(cerr);

        const instance = ProcessExecution({}, context, () => {});

        instance.execute((err) => {
          if (err) return done(err);
          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });
      });
    });

    it('returns error in callback on child error', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true">
          <serviceTask id="task" implementation="\${services.fn}" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (cerr, context) => {
        if (cerr) return done(cerr);
        context.environment.addService('fn', (arg1, next) => {
          next(new Error('Test err'));
        });

        const instance = ProcessExecution({}, context, () => {});

        instance.execute((err, errSource) => {
          expect(err).to.be.an.error('Test err');
          expect(errSource.id).to.equal('task');
          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });
      });
    });

    it('empty process completes immediately', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true" />
      </definitions>`;

      testHelpers.getContext(source, (cerr, context) => {
        if (cerr) return done(cerr);

        const instance = ProcessExecution({}, context, () => {});

        instance.execute((err) => {
          if (err) return done(err);
          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });
      });
    });

  });

  describe('signal()', () => {

    it('signals waiting child', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="tinyProcess" isExecutable="true">
          <userTask id="task" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (cerr, context) => {
        if (cerr) return done(cerr);

        const task = context.getChildActivityById('task');

        const instance = ProcessExecution({}, context, () => {});

        task.once('wait', () => {
          instance.signal('task');
        });

        instance.execute((err, lastTask) => {
          if (err) return done(err);
          expect(lastTask.id).to.equal('task');
          testHelpers.expectNoLingeringChildListeners(context);
          done();
        });
      });
    });
  });
});
