'use strict';

const Code = require('code');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const mapper = require('../../lib/mapper');

lab.experiment('Activity InputOutput', () => {
  lab.describe('ctor', () => {
    lab.test('script parameter throws if type is not JavaScript', (done) => {
      function test() {
        new mapper.ActivityIO({ // eslint-disable-line no-new
          $type: 'camunda:InputOutput',
          inputParameters: [{
            $type: 'camunda:inputParameter',
            name: 'message',
            definition: {
              $type: 'camunda:script',
              scriptFormat: 'CoffeeScript',
              value: 'i in loop'
            }
          }]
        });
      }

      expect(test).to.throw(Error, /CoffeeScript is unsupported/i);
      done();
    });

    lab.test('no children is ignored', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:InputOutput',
        inputParameters: [],
        outputParameters: []
      });

      expect(io.input).to.be.empty();
      expect(io.output).to.be.empty();

      done();
    });
  });

  lab.describe('getInput()', () => {

    lab.test('returns static values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:InputOutput',
        inputParameters: [{
          $type: 'camunda:inputParameter',
          name: 'taskinput',
          value: 'Empty'
        }],
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          value: 'I\'m done'
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          value: '1'
        }]
      });

      expect(io.getInput()).to.only.include({
        taskinput: 'Empty'
      });
      done();
    });

    lab.test('returns script values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:InputOutput',
        inputParameters: [{
          $type: 'camunda:inputParameter',
          name: 'message',
          definition: {
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            value: '"Empty"'
          },
        }],
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'arbval',
          value: '1'
        }]
      });
      expect(io.getInput()).to.only.include({
        message: 'Empty'
      });
      done();
    });

    lab.test('returns script values that address variable', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:InputOutput',
        inputParameters: [{
          $type: 'camunda:inputParameter',
          name: 'message',
          definition: {
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            value: '`Me too ${variables.arbval}`;'
          }
        }],
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'arbval',
          value: '1'
        }]
      });
      expect(io.getInput({
        variables: {
          arbval: 10
        }
      })).to.only.include({
        message: 'Me too 10'
      });
      done();
    });

    lab.test('can access parentContext variables', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="1.2.2">
  <process id="mainProcess" isExecutable="true">
    <task id="task" name="Task 1">
      <extensionElements>
        <camunda:InputOutput>
          <camunda:inputParameter name="inputMessage">
            <camunda:script scriptFormat="JavaScript">variables.input</camunda:script>
          </camunda:inputParameter>
          <camunda:outputParameter name="message">
            <camunda:script scriptFormat="JavaScript"><![CDATA[inputMessage + variables.arbval]]>;</camunda:script>
          </camunda:outputParameter>
        </camunda:InputOutput>
      </extensionElements>
    </task>
  </process>
</definitions>
      `;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);
        context.applyMessage({input: 11, arbval: 11});

        const task = context.getChildActivityById('task');
        expect(task.io.getInput()).to.include({inputMessage: 11});
        done();
      });
    });
  });

  lab.describe('getOutput()', () => {

    lab.test('returns static values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:InputOutput',
        inputParameters: [{
          $type: 'camunda:inputParameter',
          name: 'taskinput',
          value: 'Empty'
        }],
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          value: 'I\'m done'
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          value: '1'
        }]
      });

      expect(io.getOutput()).to.only.include({
        message: 'I\'m done',
        arbval: '1'
      });
      done();
    });

    lab.test('returns script values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:InputOutput',
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          definition: {
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            value: '"Me too"'
          }
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          value: '1'
        }]
      });
      expect(io.getOutput()).to.only.include({
        message: 'Me too',
        arbval: '1'
      });
      done();
    });

    lab.test('returns script values that address variable', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:InputOutput',
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          definition: {
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            value: '`Me too ${arbval}`;'
          }
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          value: '1'
        }]
      });
      expect(io.getOutput({
        arbval: 10
      })).to.only.include({
        message: 'Me too 10',
        arbval: '1'
      });
      done();
    });

    lab.test('empty parameter definition return undefined', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:InputOutput',
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          definition: {}
        }]
      });

      expect(io.getOutput({
        arbval: 10
      })).to.only.include({
        message: undefined
      });

      done();
    });

    lab.test('no parameter definition return undefined', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:InputOutput',
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message'
        }]
      });

      expect(io.getOutput({
        arbval: 10
      })).to.only.include({
        message: undefined
      });

      done();
    });

    lab.test('unknown definition type returns undefined', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:InputOutput',
        outputParameters: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          definition: {
            $type: 'madeup:script',
            scriptFormat: 'JavaScript',
            value: '`Me too ${variables.arbval}`;'
          }
        }]
      });

      expect(io.getOutput({
        variables: {
          arbval: 10
        }
      })).to.only.include({
        message: undefined
      });

      done();
    });

    lab.test('can access parentContext variables', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="1.2.2">
  <process id="mainProcess" isExecutable="true">
    <task id="task" name="Task 1">
      <extensionElements>
        <camunda:InputOutput>
          <camunda:inputParameter name="inputMessage">
            <camunda:script scriptFormat="JavaScript">variables.input</camunda:script>
          </camunda:inputParameter>
          <camunda:outputParameter name="message">
            <camunda:script scriptFormat="JavaScript"><![CDATA[inputMessage + variables.arbval]]>;</camunda:script>
          </camunda:outputParameter>
        </camunda:InputOutput>
      </extensionElements>
    </task>
  </process>
</definitions>
      `;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);
        context.applyMessage({input: 11, arbval: 11});

        const task = context.getChildActivityById('task');
        expect(task.io.getOutput(task.io.getInput())).to.include({message: 22});
        done();
      });
    });
  });

});
