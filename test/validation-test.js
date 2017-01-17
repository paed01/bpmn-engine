'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');
const validation = require('../lib/validation');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const validBpmnDefinition = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />
  </process>
</definitions>`;

lab.experiment('validation', () => {
  lab.experiment('moddle context', () => {

    lab.test('validates', (done) => {
      testHelpers.getModdleContext(validBpmnDefinition, {}, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });

    lab.test('is invalid if definitions are missing', (done) => {
      const warnings = validation.validateModdleContext(null);
      expect(warnings[0]).to.be.an.error();
      done();
    });

    lab.test('or if bpmn-moddle returns warnings in context', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="no-end" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(bpmnXml, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/no-end/);
        done();
      });
    });

  });

  lab.experiment('processes', () => {
    lab.test('validates', (done) => {
      testHelpers.getModdleContext(validBpmnDefinition, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });

    lab.test('process without flowElements', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true" />
</definitions>`;

      testHelpers.getModdleContext(bpmnXml, {}, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });
  });

  lab.experiment('lanes', () => {
    lab.test('validates', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn').toString(), {}, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });
  });

  lab.experiment('sequenceFlow', () => {
    lab.test('targetRef is required', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/"targetRef" is required/);
        done();
      });
    });

    lab.test('sourceRef is required', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <endEvent id="end" />
    <sequenceFlow id="flow2" targetRef="end" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/"sourceRef" is required/);
        done();
      });
    });

    lab.test('accepts missing references if bpmn-moddle warnings are absent, for some reason', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="no-end" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(bpmnXml, (err, context) => {
        if (err) return done(err);

        delete context.warnings;

        const warnings = validation.validateModdleContext(context);
        expect(warnings.length).to.equal(0);
        done();
      });
    });
  });

  lab.experiment('Exclusive gateway', () => {
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

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/single diverging flow/);
        done();
      });
    });

    lab.test('should not support multiple diverging flows without conditions', (done) => {
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

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/has no condition/);
        done();
      });
    });

    lab.test('should support exclusiveGateway with default flow', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow3" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[
      this.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings.length, 'Errors').to.equal(0);
        done();
      });
    });

    lab.test('should support two diverging flows with conditions', (done) => {
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

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings.length, 'Errors').to.equal(0);
        done();
      });
    });

    lab.test('without flows is NOT supported', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <exclusiveGateway id="decision" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/has no outgoing flow/);
        done();
      });
    });

  });

  lab.describe('serialized bpmn-moddle context', () => {
    lab.test('returns bpmn-moddle warnings', (done) => {
      const bpmnXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="no-end" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(bpmnXml, (err, context) => {
        if (err) return done(err);
        const contextFromDb = JSON.parse(testHelpers.serializeModdleContext(context));
        const warnings = validation.validateModdleContext(contextFromDb);
        expect(warnings.length, 'Errors').to.be.above(0);
        done();
      });
    });

    lab.test('validation is performed', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(processXml, {}, (err, context) => {
        if (err) return done(err);

        const contextFromDb = JSON.parse(testHelpers.serializeModdleContext(context));

        const warnings = validation.validateModdleContext(contextFromDb);
        expect(warnings[0]).to.be.an.error(/"targetRef" is required/);
        done();
      });
    });

  });

  lab.experiment('execute options', () => {
    lab.test('undefined options is valid', (done) => {
      function fn() {
        validation.validateOptions();
      }
      expect(fn).to.not.throw();
      done();
    });

    lab.test('empty options is valid', (done) => {
      function fn() {
        validation.validateOptions({});
      }
      expect(fn).to.not.throw();
      done();
    });

    lab.test('unsupported option throws', (done) => {
      function fn() {
        validation.validateOptions({unsupported: true});
      }
      expect(fn).to.throw();
      done();
    });

    lab.describe('listener', () => {
      lab.test('as EventEmitter is valid', (done) => {
        function fn() {
          validation.validateOptions({
            listener: new EventEmitter()
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('with self declared emit function is valid', (done) => {
        function fn() {
          validation.validateOptions({
            listener: {
              emit: () => {}
            }
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('without emit function is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            listener: {}
          });
        }
        expect(fn).to.throw(Error, /"emit" function is required/);
        done();
      });
    });

    lab.describe('variables', () => {
      lab.test('as an object is valid', (done) => {
        function fn() {
          validation.validateOptions({
            variables: {}
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('as not an object is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            variables: 'gr'
          });
        }
        expect(fn).to.throw(Error, /must be an object/);
        done();
      });
    });

    lab.describe('services', () => {
      lab.test('with service as a function is valid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              testFn: function() {}
            }
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('service type require', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              get: {
                module: 'request',
                type: 'require',
                fnName: 'get'
              }
            }
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('service type global', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              getElementById: {
                module: 'document',
                type: 'global'
              }
            }
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('without type', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              get: {
                module: 'request'
              }
            }
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('without service module is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              get: {
                type: 'require'
              }
            }
          });
        }
        expect(fn).to.throw(Error, /module must be a string/);
        done();
      });

      lab.test('empty service object is valid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {}
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('not an object is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            services: function() {}
          });
        }
        expect(fn).to.throw(Error, /must be an object/);
        done();
      });

      lab.test('service as string is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              put: 'myService'
            }
          });
        }
        expect(fn).to.throw(Error, /is not a function or an object/);
        done();
      });

      lab.test('type not global or require is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              put: {
                module: 'request',
                type: 'POST'
              }
            }
          });
        }
        expect(fn).to.throw(Error, /must be global or require/);
        done();
      });

      lab.test('services undefined is valid', (done) => {
        function fn() {
          validation.validateOptions({
            services: undefined
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      lab.test('service undefined is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {
              missing: undefined
            }
          });
        }
        expect(fn).to.throw(Error, /is undefined/);
        done();
      });
    });
  });
});
