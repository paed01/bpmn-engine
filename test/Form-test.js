'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('./helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../');

lab.experiment('Forms', () => {
  lab.describe('with default value', () => {
    lab.test('returns value from expression', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="inputDate" label="Input date" type="date" defaultValue="\${variables.now}" />
        </camunda:formData>
      </extensionElements>
      </startEvent>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
  </process>
</definitions>`;


      const listener = new EventEmitter();

      listener.once('wait-start', (task) => {
        expect(task.form.getFields()[0]).to.include({
          defaultValue: new Date('2017-02-05')
        });

        done();
      });

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.execute({
        listener: listener,
        variables: {
          now: new Date('2017-02-05')
        }
      });
    });
  });

  lab.describe('start form', () => {
    lab.test('waits for start', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-start', (task) => {
        const fields = task.form.getFields();

        expect(fields[0]).to.include({
          defaultValue: new Date('2017-02-05')
        });

        const reply = {};
        reply[fields[0].id] = new Date('2017-02-06');

        task.signal(reply);
      });

      listener.once('wait-userTask', (task) => {
        const fields = task.form.getFields();

        expect(fields[0]).to.include({
          defaultValue: new Date('2017-02-06')
        });

        const reply = {};
        reply[fields[0].id] = new Date('2017-02-07');

        task.signal(reply);
      });

      const engine = new Bpmn.Engine({
        source: factory.resource('forms.bpmn'),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.once('end', () => {
        expect(engine.definitions[0].variables).to.include({
          startDate: new Date('2017-02-07')
        });
        done();
      });

      engine.execute({
        listener: listener,
        variables: {
          now: new Date('2017-02-05')
        }
      });
    });

  });

  lab.describe('getState()', () => {
    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="formfield1" label="FormField1" type="string" />
          <camunda:formField id="formfield2" type="long" />
        </camunda:formData>
      </extensionElements>
    </startEvent>
    <userTask id="task">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="surname" label="Surname" type="string" />
          <camunda:formField id="givenName" label="Given name" type="string" />
        </camunda:formData>
      </extensionElements>
    </userTask>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

    lab.test('before init returns form fields', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (event, instance) => {
        engine.stop();
        const task = instance.getChildActivityById('task');

        const state = task.form.getState();
        expect(state).to.include(['fields']);
        expect(state.fields).to.have.length(2);
        expect(state.fields[0]).to.only.include(['id', 'label', 'type']);
        expect(state.fields[1]).to.only.include(['id', 'label', 'type']);

        expect(state.fields[0]).to.equal({
          id: 'surname',
          label: 'Surname',
          type: 'string'
        });
        done();
      });

      engine.execute({
        listener: listener
      });
    });

    lab.test('after init returns form fields', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (event) => {
        engine.stop();
        const state = event.form.getState();
        expect(state).to.include(['fields']);
        expect(state.fields).to.have.length(2);
        expect(state.fields[0]).to.only.include(['id', 'label', 'type']);
        expect(state.fields[1]).to.only.include(['id', 'label', 'type']);

        expect(state.fields[0]).to.equal({
          id: 'formfield1',
          label: 'FormField1',
          type: 'string'
        });
        done();
      });

      engine.execute({
        listener: listener
      });
    });

    lab.test('sets key value with expression', (done) => {
      const formKeyProcessXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions id="testFormKey" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="theProcess" isExecutable="true">
      <userTask id="task" camunda:formKey="\${variables.inputForm}" />
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine({
        source: formKeyProcessXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-task', (task) => {
        engine.stop();
        const state = task.form.getState();
        expect(state).to.not.include(['fields']);
        expect(state.key).to.equal('form2');
        done();
      });

      engine.execute({
        listener: listener,
        variables: {
          inputForm: 'form2'
        }
      });
    });

  });

  lab.describe('with formKey', () => {
    lab.test('start event emits wait', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions id="testFormKey" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="theProcess" isExecutable="true">
      <startEvent id="start" camunda:formKey="form1" />
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (task) => {
        task.signal({ key: task.form.key });
      });

      engine.once('end', (def) => {
        expect(def.variables).to.equal({
          key: 'form1'
        });
        done();
      });

      engine.execute({
        listener: listener,
        variables: {}
      });
    });

    lab.test('sets key value with expression', (done) => {
      const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions id="testFormKey" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="theProcess" isExecutable="true">
      <startEvent id="start" camunda:formKey="\${variables.inputForm}" />
      <userTask id="task" camunda:formKey="\${variables.inputForm}" />
      <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    </process>
  </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (event) => {
        expect(event.form.key).to.equal('form1');
        event.signal({ inputForm: 'form2' });
      });
      listener.once('wait-task', (task) => {
        task.signal({ key: task.form.key });
      });

      engine.once('end', (def) => {
        expect(def.variables.taskInput.task).to.contain({
          key: 'form2'
        });
        done();
      });

      engine.execute({
        listener: listener,
        variables: {
          inputForm: 'form1'
        }
      });
    });
  });
});
