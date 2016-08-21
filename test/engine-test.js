'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const factory = require('./helpers/factory');
const Bpmn = require('..');

lab.experiment('engine', () => {
  lab.test('Bpmn exposes executor module', (done) => {
    expect(Bpmn).to.include('Engine');
    done();
  });

  lab.experiment('#ctor', () => {
    lab.test('takes process definition as argument', (done) => {
      const engine = new Bpmn.Engine(factory.valid());
      expect(engine.source).to.exist();
      done();
    });

    lab.test('accepts Buffer', (done) => {
      const buff = new Buffer(factory.valid());
      const engine = new Bpmn.Engine(buff);
      expect(engine.source).to.exist();
      done();
    });
  });

  lab.experiment('#startInstance', () => {
    lab.test('sets entry point id to executable process', (done) => {
      const engine = new Bpmn.Engine(factory.valid());
      engine.startInstance(null, null, (err) => {
        expect(err).to.not.exist();
        expect(engine.entryPointId).to.equal('theProcess1');
        done();
      });
    });

    lab.test('returns error in callback if no activity definition', (done) => {
      const engine = new Bpmn.Engine('');
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if not well formatted xml', (done) => {
      const engine = new Bpmn.Engine('jdalsk');
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });
  });

  lab.experiment('exclusivegateway', () => {

    lab.test('should support one diverging flow without a condition', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <exclusiveGateway id="decision" />
  <endEvent id="end" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
  <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />
</process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);
        execution.once('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(3);
            done();
          }
        });
      });
    });

    lab.test('should not support a single diverging flow with a condition', (done) => {

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('should not support multiple diverging flows without conditions', (done) => {

      // if there multiple outgoing sequence flows without conditions, an exception is thrown at deploy time,
      // even if one of them is the default flow

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err) => {
        expect(err).to.exist();
        done();
      });

    });

    lab.test('should support two diverging flows with conditions, case 10', (done) => {

      // case 1: input  = 10 -> the upper sequenceflow is taken

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 10
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.once('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(3);
            expect(execution.getChildActivityById('end1').taken).to.be.true();
            expect(execution.getChildActivityById('end2').taken, 'end2').to.be.false();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.not.include('flow3');
            done();
          }
        });
      });
    });

    lab.test('should support two diverging flows with conditions, case 100', (done) => {

      // case 2: input  = 100 -> the lower sequenceflow is taken

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 100
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.once('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(3);
            expect(execution.getChildActivityById('end1').taken, 'end1').to.be.false();
            expect(execution.getChildActivityById('end2').taken, 'end2').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.not.include('flow2');
            expect(execution.paths).to.include('flow3');
            done();
          }
        });
      });
    });

    lab.test('should support diverging flows with default, case 1', (done) => {

      // case 2: input  = 100 -> the default sequenceflow is taken

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 100
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.once('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(3);
            expect(execution.getChildActivityById('end1').taken, 'end1').to.be.true();
            expect(execution.getChildActivityById('end2').taken, 'end2').to.be.false();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.not.include('flow3');
            done();
          }
        });
      });
    });

    lab.test('should support diverging flows with default, case 2', (done) => {

      // case 2: input  = 50 -> the lower sequenceflow is taken

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 50
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.once('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(3);
            expect(execution.getChildActivityById('end1').taken, 'end1').to.be.false();
            expect(execution.getChildActivityById('end2').taken, 'end2').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.not.include('flow2');
            expect(execution.paths).to.include('flow3');
            done();
          }
        });
      });
    });

  });

  lab.experiment('parallelgateway', () => {
    lab.test('should fork multiple diverging flows', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="end2" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(4);
            expect(execution.getChildActivityById('end1').taken, 'end1').to.be.true();
            expect(execution.getChildActivityById('end2').taken, 'end2').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.include('flow3');
            done();
          }
        });
      });
    });

    lab.test('should fork and join multiple diverging flows', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <parallelGateway id="fork" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
    <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance(null, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(4);
            expect(execution.getChildActivityById('end').taken, 'end').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.include('flow3');
            expect(execution.paths).to.include('flow4');
            done();
          }
        });
      });

    });
  });

  lab.experiment('InclusiveGateway', () => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <inclusiveGateway id="decision" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="theEnd1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow4" sourceRef="decision" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

    lab.test('should support multiple conditional flows, case 1', (done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 1
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(5);
            expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
            expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
            expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.include('flow3');
            expect(execution.paths).to.include('flow4');
            done();
          }
        });
      });
    });

    lab.test('should support the default flow in combination with multiple conditional flows, case 2', (done) => {
      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 40
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(4);
            expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.false();
            expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
            expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.true();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.not.include('flow3');
            expect(execution.paths).to.not.include('flow4');
            done();
          }
        });
      });
    });

  });


  lab.experiment('Uncontrolled flows', () => {
    lab.test('should support the default flow in combination with multiple conditional flows, case 1', (done) => {

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" default="flow1" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />
    <sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 1
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(4);
            expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.true();
            expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.false();
            expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.false();
            expect(execution.paths).to.include('flow1');
            expect(execution.paths).to.not.include('flow2');
            expect(execution.paths).to.not.include('flow3');
            done();
          }
        });
      });

    });

    lab.test('should support the default flow in combination with multiple conditional flows, case 2', (done) => {

      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" default="flow1" />
    <endEvent id="theEnd1" />
    <endEvent id="theEnd2" />
    <endEvent id="theEnd3" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />
    <sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 20
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

      const engine = new Bpmn.Engine(processXml);
      engine.startInstance({
        input: 40
      }, null, (err, execution) => {
        if (err) return done(err);

        execution.on('end', (e) => {
          if (e.activity.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            expect(Object.keys(execution.children).length).to.equal(4);
            expect(execution.getChildActivityById('theEnd1').taken, 'theEnd1').to.be.false();
            expect(execution.getChildActivityById('theEnd2').taken, 'theEnd2').to.be.true();
            expect(execution.getChildActivityById('theEnd3').taken, 'theEnd3').to.be.true();
            expect(execution.paths).to.not.include('flow1');
            expect(execution.paths).to.include('flow2');
            expect(execution.paths).to.include('flow3');
            done();
          }
        });
      });
    });

    lab.test('should support the default flow in combination with multiple conditional flows, case 3', (done) => {

      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" default="flow1" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +
        '<endEvent id="theEnd3" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 100
      }, null, (err, execution) => {
        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(2);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("theEnd1");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });

    lab.test('should support the default flow in combination with multiple conditional and unconditional flows, case 1', (done) => {

      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" default="flow1" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +
        '<endEvent id="theEnd3" />' +
        '<endEvent id="theEnd4" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd4" />' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 10
      }, null, (err, execution) => {
        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(4);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("theEnd2");
            expect(processInstance.activities[2].activityId).to.equal("theEnd3");
            expect(processInstance.activities[3].activityId).to.equal("theEnd4");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });

    lab.test('should support the default flow in combination with multiple conditional and unconditional flows, case 2', (done) => {

      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" default="flow1" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +
        '<endEvent id="theEnd3" />' +
        '<endEvent id="theEnd4" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd4" />' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 40
      }, null, (err, execution) => {
        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(3);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("theEnd2");
            expect(processInstance.activities[2].activityId).to.equal("theEnd4");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });

    lab.test('should support the default flow in combination with multiple conditional and unconditional flows, case 3', (done) => {

      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" default="flow1" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +
        '<endEvent id="theEnd3" />' +
        '<endEvent id="theEnd4" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd4" />' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 100
      }, null, (err, execution) => {
        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(3);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("theEnd4");
            expect(processInstance.activities[2].activityId).to.equal("theEnd1");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });

    lab.test('should support multiple conditional flows, case 1', (done) => {
      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 10
      }, null, (err, execution) => {
        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(3);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("theEnd1");
            expect(processInstance.activities[2].activityId).to.equal("theEnd2");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });

    lab.test('should support multiple conditional flows, case 2', (done) => {
      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 40
      }, null, (err, execution) => {
        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(2);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("theEnd1");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });

      // // case 2: input  = 100 -> no sequenceflow is taken.
      // // TODO: should this trigger an exception??

      // execution = new CAM.ActivityExecution(processDefinition);
      // execution.variables.input = 100;
      // execution.start();

      // expect(execution.isEnded).toBe(false);

      // processInstance = execution.getActivityInstance();
      // expect(processInstance.activities.length).toBe(1);
      // expect(processInstance.activities[0].activityId).toBe("theStart");

    });

    lab.test('should support multiple conditional flows, case 3, emits error when no conditional flow is taken', (done) => {
      var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

        '<process id="theProcess" isExecutable="true">' +

        '<startEvent id="theStart" />' +
        '<endEvent id="theEnd1" />' +
        '<endEvent id="theEnd2" />' +

        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 50 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +
        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
        'this.input <= 20 ' +
        ']]></conditionExpression>' +
        '</sequenceFlow>' +

        '</process>' +

        '</definitions>');

      engine.startInstance(processXml, {
        input: 100
      }, null, (err, execution) => {
        execution.on('error', (e) => {
          expect(execution.isEnded).to.equal(false);
          var processInstance = execution.getActivityInstance();

          expect(processInstance.activities.length).to.equal(1);
          expect(processInstance.activities[0].activityId).to.equal("theStart");
          done();
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });
  });

  lab.experiment('usertask', () => {
    var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
      '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<process id="theProcess" isExecutable="true">' +
      '<startEvent id="theStart" />' +
      '<userTask id="userTask" />' +
      '<endEvent id="theEnd" />' +
      '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />' +
      '<sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />' +
      '</process>' +
      '</definitions>');

    lab.test('should handle user tasks as wait states', (done) => {
      engine.startInstance(processXml, null, null, (err, execution) => {
        execution.on('start', (e) => {
          if (e.id === 'userTask') {
            expect(execution.isEnded).to.equal(false);

            var processInstance = execution.getActivityInstance();
            expect(processInstance.activities.length).to.equal(2);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("userTask");

            execution.activityExecutions[1].signal();
          }
        });

        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);

            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.equal(3);
            expect(processInstance.activities[0].activityId).to.equal("theStart");
            expect(processInstance.activities[1].activityId).to.equal("userTask");
            expect(processInstance.activities[2].activityId).to.equal("theEnd");
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });
    });

    lab.test('should signal user task by id', (done) => {
      engine.startInstance(processXml, null, null, (err, execution) => {
        execution.on('start', (e) => {
          if (e.id === 'userTask') {
            // send a signal to the usertask:
            execution.signal("userTask");
          }
        });

        execution.on('end', (e) => {
          if (e.id === 'theProcess') {
            expect(execution.isEnded).to.equal(true);
            done();
          }
        });

        expect(err).to.not.exist();
        expect(execution).to.exist();
      });

      // var processDefinition = new Transformer().transform(processXml)[0];

      // var execution = new CAM.ActivityExecution(processDefinition);
      // execution.start();

      // // the activity is NOT ended
      // expect(execution.isEnded).toBe(false);

      // // send a signal to the usertask:
      // execution.signal("userTask");

      // // now the process is ended
      // expect(execution.isEnded).toBe(true);
    });
  });
});
