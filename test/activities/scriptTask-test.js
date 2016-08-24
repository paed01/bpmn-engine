'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../..');

lab.experiment('ScriptTask', () => {

  lab.test('should have inbound and outbound sequence flows', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        this.context.input = 2;
        next();
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.startInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const activity = execution.getChildActivityById('scriptTask');
      expect(activity).to.include('inbound');
      expect(activity.inbound).to.have.length(1);
      expect(activity).to.include('outbound');
      expect(activity.outbound).to.have.length(1);
      done();
    });
  });

  lab.test('emits error if returned in next function', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        next(new Error('Inside'));
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      const activity = execution.getChildActivityById('scriptTask');

      activity.once('error', (e) => {
        expect(e).to.exist();
        expect(e).to.be.an.error(Error, 'Inside');
        done();
      });

      activity.run();
    });
  });

  lab.test('throws if compilation fault', (done) => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        function a() {
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

    const engine = new Bpmn.Engine(processXml);
    engine.getInstance(null, null, (err, execution) => {
      if (err) return done(err);
      try {
        execution.getChildActivityById('scriptTask');
        Code.fail('Should have thrown');
      } catch (e) {
        expect(e).to.be.an.error(SyntaxError);
      }
      done();
    });
  });
});
