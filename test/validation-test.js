'use strict';

const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');
const validation = require('../lib/validation');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;


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

describe('validation', () => {
  describe('moddle context', () => {

    it('validates', (done) => {
      testHelpers.getModdleContext(validBpmnDefinition, {}, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });

    it('is invalid if definitions are missing', (done) => {
      const warnings = validation.validateModdleContext(null);
      expect(warnings[0]).to.be.an.error();
      done();
    });

    it('or if bpmn-moddle returns warnings in context', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="no-end" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);

        expect(warnings[0]).to.be.an.error(/no-end/);
        done();
      });
    });

  });

  describe('processes', () => {
    it('validates', (done) => {
      testHelpers.getModdleContext(validBpmnDefinition, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });

    it('process without flowElements', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true" />
      </definitions>`;

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });
  });

  describe('lanes', () => {
    it('validates', (done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn').toString(), {}, (err, context) => {
        if (err) return done(err);
        done(validation.validateModdleContext(context)[0]);
      });
    });
  });

  describe('sequenceFlow', () => {
    it('targetRef is required', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <sequenceFlow id="flow1" sourceRef="theStart" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/"targetRef" is required/);
        done();
      });
    });

    it('sourceRef is required', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <endEvent id="end" />
          <sequenceFlow id="flow2" targetRef="end" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/"sourceRef" is required/);
        done();
      });
    });

    it('accepts missing references if bpmn-moddle warnings are absent, for some reason', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="no-end" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, (err, context) => {
        if (err) return done(err);

        context.warnings = undefined;

        const warnings = validation.validateModdleContext(context);
        expect(warnings.length).to.equal(0);
        done();
      });
    });
  });

  describe('Exclusive gateway', () => {
    it('should not support a single diverging flow with a condition', (done) => {
      const source = `
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

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/single diverging flow/);
        done();
      });
    });

    it('should not support multiple diverging flows without conditions', (done) => {
      const source = `
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

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);
        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/has no condition/);
        done();
      });
    });

    it('should support exclusiveGateway with default flow', (done) => {
      const source = `
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

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings.length, 'Errors').to.equal(0);
        done();
      });
    });

    it('should support two diverging flows with conditions', (done) => {
      const source = `
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

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings.length, 'Errors').to.equal(0);
        done();
      });
    });

    it('without flows is NOT supported', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <exclusiveGateway id="decision" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);

        const warnings = validation.validateModdleContext(context);
        expect(warnings[0]).to.be.an.error(/has no outgoing flow/);
        done();
      });
    });

  });

  lab.describe('serialized bpmn-moddle context', () => {
    it('returns bpmn-moddle warnings', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="no-end" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, (err, context) => {
        if (err) return done(err);
        const contextFromDb = JSON.parse(testHelpers.serializeModdleContext(context));
        const warnings = validation.validateModdleContext(contextFromDb);
        expect(warnings.length, 'Errors').to.be.above(0);
        done();
      });
    });

    it('validation is performed', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <sequenceFlow id="flow1" sourceRef="theStart" />
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, {}, (err, context) => {
        if (err) return done(err);

        const contextFromDb = JSON.parse(testHelpers.serializeModdleContext(context));

        const warnings = validation.validateModdleContext(contextFromDb);
        expect(warnings[0]).to.be.an.error(/"targetRef" is required/);
        done();
      });
    });

  });

  describe('execute options', () => {
    it('undefined options is valid', (done) => {
      function fn() {
        validation.validateOptions();
      }
      expect(fn).to.not.throw();
      done();
    });

    it('empty options is valid', (done) => {
      function fn() {
        validation.validateOptions({});
      }
      expect(fn).to.not.throw();
      done();
    });

    it('arbitratry option is valid', (done) => {
      function fn() {
        validation.validateOptions({unsupported: true});
      }
      expect(fn).to.not.throw();
      done();
    });

    lab.describe('listener', () => {
      it('as EventEmitter is valid', (done) => {
        function fn() {
          validation.validateOptions({
            listener: new EventEmitter()
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      it('with self declared emit function is valid', (done) => {
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

      it('without emit function is invalid', (done) => {
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
      it('as an object is valid', (done) => {
        function fn() {
          validation.validateOptions({
            variables: {}
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      it('as not an object is invalid', (done) => {
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
      it('with service as a function is valid', (done) => {
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

      it('service type require', (done) => {
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

      it('service type global', (done) => {
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

      it('without type', (done) => {
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

      it('without service module is invalid', (done) => {
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

      it('empty service object is valid', (done) => {
        function fn() {
          validation.validateOptions({
            services: {}
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      it('not an object is invalid', (done) => {
        function fn() {
          validation.validateOptions({
            services: function() {}
          });
        }
        expect(fn).to.throw(Error, /must be an object/);
        done();
      });

      it('service as string is invalid', (done) => {
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

      it('type not global or require is invalid', (done) => {
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

      it('services undefined is valid', (done) => {
        function fn() {
          validation.validateOptions({
            services: undefined
          });
        }
        expect(fn).to.not.throw();
        done();
      });

      it('service undefined is invalid', (done) => {
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
