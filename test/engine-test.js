'use strict';

const Code = require('code');
const Bpmn = require('..');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

lab.experiment('engine', () => {
  lab.test('Bpmn exposes executor module', (done) => {
    expect(Bpmn).to.include('Engine');
    done();
  });

  lab.experiment('#ctor', () => {
    lab.test('takes activityExecution as module and transformer as instance', (done) => {
      const transformer = new Bpmn.Transformer();
      const engine = new Bpmn.Engine(Bpmn.ActivityExecution, transformer);

      expect(engine.executor).to.exist();
      expect(engine.transformer).to.exist();

      expect(engine.executor).to.be.a.function();
      expect(engine.transformer).to.be.an.object();
      expect(engine.transformer).to.be.instanceof(Bpmn.Transformer);

      done();
    });

    lab.test('takes only activityExecution and instanciates own transformer', (done) => {
      const engine = new Bpmn.Engine(Bpmn.ActivityExecution);

      expect(engine.executor).to.exist();
      expect(engine.transformer).to.exist();

      expect(engine.executor).to.be.a.function();

      done();
    });

    lab.test('takes no arguments and returns object with executor and transformer', (done) => {
      const engine = new Bpmn.Engine();

      expect(engine.executor).to.exist();
      expect(engine.transformer).to.exist();

      expect(engine.executor).to.be.a.function();
      expect(engine.transformer).to.be.an.object();

      done();
    });
  });

  lab.experiment('#startInstance', () => {
    // var transformer = new Bpmn.Transformer();
    // var engine = new Bpmn.Engine(Bpmn.ActivityExecution, transformer);
    const engine = new Bpmn.Engine();
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression>true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
`;

    lab.test('returns error in callback if no activity definition', (done) => {
      engine.startInstance(null, null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if passed array as source', (done) => {
      engine.startInstance([], null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if activity definition is empty string', (done) => {
      engine.startInstance('', null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns activity execution if definition is string', (done) => {
      engine.startInstance(processXml, null, null, (err, execution) => {
        if (err) return done(err);

        expect(execution).to.exist();
        expect(execution.start).to.be.a.function();
        done();
      });
    });

    lab.test('returns activity execution if definition is Buffer', (done) => {
      const buff = new Buffer(processXml);
      engine.startInstance(buff, null, null, (err, execution) => {
        if (err) return done(err);

        expect(execution).to.exist();
        expect(execution.start).to.be.a.function();
        done();
      });
    });

    lab.test('returns error in callback if activity definition source is function', (done) => {
      engine.startInstance(() => {}, null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if activity definition source is undefined', (done) => {
      engine.startInstance(undefined, null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if not well formatted xml', (done) => {
      engine.startInstance(new Buffer('jdalsk'), null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if file not found', (done) => {
      engine.startInstance('jdalsk', null, null, (err) => {
        expect(err).to.exist();
        done();
      });
    });
  });

  lab.experiment('original tests', () => {
    var transformer = new Bpmn.Transformer();
    var engine = new Bpmn.Engine(Bpmn.ActivityExecution, transformer);

    lab.experiment('exclusivegateway', () => {

      lab.test('should support one diverging flow without a condition', (done) => {

        var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<process id="theProcess" isExecutable="true">' +
          '  <startEvent id="theStart" />' +
          '  <exclusiveGateway id="decision" />' +
          '  <endEvent id="end" />' +
          '  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
          '  <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />' +
          '</process>' +
          '</definitions>';

        engine.startInstance(processXml, null, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql('theStart');
              expect(processInstance.activities[1].activityId).to.eql('decision');
              expect(processInstance.activities[2].activityId).to.eql('end');
              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
        });
      });

      lab.test('should not support a single diverging flow with a condition', (done) => {

        var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<process id="theProcess" isExecutable="true">' +
          '<startEvent id="theStart" />' +
          '<exclusiveGateway id="decision" />' +
          '<endEvent id="end" />' +
          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
          '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end">' +
          '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
          'this.input <= 50 ' +
          ']]></conditionExpression>' +
          '</sequenceFlow>' +
          '</process>' +
          '</definitions>';

        engine.startInstance(processXml, null, null, (err) => {
          expect(err).to.exist();
          done();
        });
      });

      lab.test('should not support multiple diverging flows without conditions', (done) => {

        // if there multiple outgoing sequence flows without conditions, an exception is thrown at deploy time,
        // even if one of them is the default flow

        var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

          '<process id="theProcess" isExecutable="true">' +

          '<startEvent id="theStart" />' +
          '<exclusiveGateway id="decision" />' +
          '<endEvent id="end1" />' +
          '<endEvent id="end2" />' +

          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
          '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />' +
          '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2" />' +

          '</process>' +

          '</definitions>';

        engine.startInstance(processXml, null, null, (err) => {
          expect(err).to.exist();
          done();
        });

      });

      lab.test('should support two diverging flows with conditions, case 10', (done) => {

        // case 1: input  = 10 -> the upper sequenceflow is taken

        var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

          '<process id="theProcess" isExecutable="true">' +

          '<startEvent id="theStart" />' +
          '<exclusiveGateway id="decision" />' +
          '<endEvent id="end1" />' +
          '<endEvent id="end2" />' +

          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
          '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">' +
          '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
          'this.input <= 50 ' +
          ']]></conditionExpression>' +
          '</sequenceFlow>' +
          '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
          '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
          'this.input > 50 ' +
          ']]></conditionExpression>' +
          '</sequenceFlow>' +

          '</process>' +

          '</definitions>';

        engine.startInstance(processXml, {
          input: 10
        }, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql('theStart');
              expect(processInstance.activities[1].activityId).to.eql('decision');
              expect(processInstance.activities[2].activityId).to.eql('end1');
              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
        });
      });

      lab.test('should support two diverging flows with conditions, case 100', (done) => {

        // case 2: input  = 100 -> the lower sequenceflow is taken

        var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

          '<process id="theProcess" isExecutable="true">' +

          '<startEvent id="theStart" />' +
          '<exclusiveGateway id="decision" />' +
          '<endEvent id="end1" />' +
          '<endEvent id="end2" />' +

          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
          '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">' +
          '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
          'this.input <= 50 ' +
          ']]></conditionExpression>' +
          '</sequenceFlow>' +
          '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
          '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
          'this.input > 50 ' +
          ']]></conditionExpression>' +
          '</sequenceFlow>' +

          '</process>' +

          '</definitions>');

        engine.startInstance(processXml, {
          input: 100
        }, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql('theStart');
              expect(processInstance.activities[1].activityId).to.eql('decision');
              expect(processInstance.activities[2].activityId).to.eql('end2');
              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
        });
      });

    });

    lab.experiment('parallelgateway', () => {
      lab.test('should fork multiple diverging flows', (done) => {
        var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<process id="theProcess" isExecutable="true">' +
          '<startEvent id="theStart" />' +
          '<parallelGateway id="fork" />' +
          '<endEvent id="end1" />' +
          '<endEvent id="end2" />' +
          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />' +
          '<sequenceFlow id="flow2" sourceRef="fork" targetRef="end1" />' +
          '<sequenceFlow id="flow3" sourceRef="fork" targetRef="end2" />' +
          '</process>' +
          '</definitions>');

        engine.startInstance(processXml, {
          input: 10
        }, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(4);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("fork");
              expect(processInstance.activities[2].activityId).to.eql("end1");
              expect(processInstance.activities[3].activityId).to.eql("end2");

              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
        });

      });

      lab.test('should join multiple converging flows', (done) => {
        var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<process id="theProcess" isExecutable="true">' +
          '<startEvent id="theStart" />' +
          '<parallelGateway id="fork" />' +
          '<parallelGateway id="join" />' +
          '<endEvent id="end" />' +
          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />' +
          '<sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />' +
          '<sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />' +
          '<sequenceFlow id="flow4" sourceRef="join" targetRef="end" />' +
          '</process>' +
          '</definitions>');

        engine.startInstance(processXml, {
          input: 10
        }, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(5);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("fork");
              expect(processInstance.activities[2].activityId).to.eql("join");
              expect(processInstance.activities[3].activityId).to.eql("join");
              expect(processInstance.activities[4].activityId).to.eql("end");

              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
        });
      });
    });

    lab.experiment('sequenceFlow', () => {

      lab.test('should not support the default flow if there are no conditional flows', (done) => {
        var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
          '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<process id="theProcess" isExecutable="true">' +
          '<startEvent id="theStart" default="flow1" />' +
          '<endEvent id="theEnd" />' +
          '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd" />' +
          '</process>' +
          '</definitions>');

        engine.startInstance(processXml, null, null, (err) => {
          expect(err).to.exist();
          expect(err.message).to.eql("Activity with id 'theStart' declares default flow with id 'flow1' but has no conditional flows.");
          done();
        });

        // expect(t).toThrow();

      });

      lab.test('should support the default flow in combination with multiple conditional flows, case 1', (done) => {

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
          input: 10
        }, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd2");
              expect(processInstance.activities[2].activityId).to.eql("theEnd3");
              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
        });

      });

      lab.test('should support the default flow in combination with multiple conditional flows, case 2', (done) => {

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
          input: 40
        }, null, (err, execution) => {
          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(2);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd2");
              done();
            }
          });

          expect(err).to.not.exist();
          expect(execution).to.exist();
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
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(2);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd1");
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
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(4);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd2");
              expect(processInstance.activities[2].activityId).to.eql("theEnd3");
              expect(processInstance.activities[3].activityId).to.eql("theEnd4");
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
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd2");
              expect(processInstance.activities[2].activityId).to.eql("theEnd4");
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
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd4");
              expect(processInstance.activities[2].activityId).to.eql("theEnd1");
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
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd1");
              expect(processInstance.activities[2].activityId).to.eql("theEnd2");
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
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(2);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("theEnd1");
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
            expect(execution.isEnded).to.eql(false);
            var processInstance = execution.getActivityInstance();

            expect(processInstance.activities.length).to.eql(1);
            expect(processInstance.activities[0].activityId).to.eql("theStart");
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
              expect(execution.isEnded).to.eql(false);

              var processInstance = execution.getActivityInstance();
              expect(processInstance.activities.length).to.eql(2);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("userTask");

              execution.activityExecutions[1].signal();
            }
          });

          execution.on('end', (e) => {
            if (e.id === 'theProcess') {
              expect(execution.isEnded).to.eql(true);

              var processInstance = execution.getActivityInstance();

              expect(processInstance.activities.length).to.eql(3);
              expect(processInstance.activities[0].activityId).to.eql("theStart");
              expect(processInstance.activities[1].activityId).to.eql("userTask");
              expect(processInstance.activities[2].activityId).to.eql("theEnd");
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
              expect(execution.isEnded).to.eql(true);
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
});
