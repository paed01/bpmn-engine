'use strict';

const {Engine} = require('../../.');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('Forms', () => {
  describe('with default value', () => {
    it('returns value from expression', (done) => {
      const source = `
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

      listener.once('wait-start', (activityApi) => {
        expect(activityApi.form.getFields()[0]).to.include({
          defaultValue: new Date('2017-02-05')
        });

        done();
      });

      const engine = new Engine({
        source,
        moddleOptions
      });

      engine.execute({
        listener,
        variables: {
          now: new Date('2017-02-05')
        }
      });
    });
  });

  describe('start form', () => {
    it('waits for start', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-start', (activityApi) => {
        const fields = activityApi.form.getFields();

        expect(fields[0]).to.include({
          defaultValue: new Date('2017-02-05')
        });

        const reply = {};
        reply[fields[0].id] = new Date('2017-02-06');

        activityApi.signal(reply);
      });

      listener.once('wait-userTask', (activityApi) => {
        const fields = activityApi.form.getFields();

        expect(fields[0]).to.include({
          defaultValue: new Date('2017-02-06')
        });

        const reply = {};
        reply[fields[0].id] = new Date('2017-02-07');

        activityApi.signal(reply);
      });

      const engine = new Engine({
        source: factory.resource('forms.bpmn'),
        moddleOptions
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput()).to.include({
          startDate: new Date('2017-02-07')
        });
        done();
      });

      engine.execute({
        listener,
        variables: {
          now: new Date('2017-02-05')
        }
      });
    });
  });

  describe('getState()', () => {
    const source = `
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

    it('before init returns form fields', (done) => {
      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi, instance) => {
        engine.stop();

        const task = instance.getChildActivityById('task');

        const state = task.form.getState();
        expect(state).to.include(['fields']);
        expect(state.fields).to.have.length(2);
        expect(state.fields[0]).to.only.include(['id', 'label', 'valueType']);
        expect(state.fields[1]).to.only.include(['id', 'label', 'valueType']);

        expect(state.fields[0]).to.equal({
          id: 'surname',
          label: 'Surname',
          valueType: 'string'
        });
        done();
      });

      engine.execute({
        listener
      });
    });

    it('after init returns form fields', (done) => {
      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        engine.stop();
        const state = activityApi.form.getState();
        expect(state).to.include(['fields']);
        expect(state.fields).to.have.length(2);
        expect(state.fields[0]).to.only.include(['id', 'label', 'valueType']);
        expect(state.fields[1]).to.only.include(['id', 'label', 'valueType']);

        expect(state.fields[0]).to.equal({
          id: 'formfield1',
          label: 'FormField1',
          valueType: 'string'
        });
        done();
      });

      engine.execute({
        listener
      });
    });

    it('sets key value with expression', (done) => {
      const source2 = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testFormKey" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <userTask id="task" camunda:formKey="\${variables.inputForm}" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: source2,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-task', (activityApi) => {
        engine.stop();
        const state = activityApi.getState();
        expect(state.formKey).to.equal('form2');
        done();
      });

      engine.execute({
        listener,
        variables: {
          inputForm: 'form2'
        }
      });
    });

  });

  describe('resume()', () => {
    const source = `
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

    it('resumes with assigned values', (done) => {
      const engine = new Engine({
        source,
        moddleOptions
      });

      let listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        expect(activityApi.form.setFieldValue('formfield1', 'stop')).to.be.true();
        engine.stop();
      });

      engine.execute({
        listener
      });

      engine.on('end', () => {
        const state = engine.getState();
        listener = new EventEmitter();

        Engine.resume(state, {listener});

        listener.on('wait-start', ({form}) => {
          const field = form.getField('formfield1');
          expect(field.get()).to.equal('stop');
          done();
        });

      });
    });

    it('resumes with assigned values', (done) => {
      const engine = new Engine({
        source,
        moddleOptions
      });

      let listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        expect(activityApi.form.setFieldValue('formfield1', 'stop2')).to.be.true();
        engine.stop();
      });

      engine.execute({
        listener
      });

      engine.on('end', () => {
        const state = engine.getState();
        listener = new EventEmitter();

        listener.on('wait-start', ({form, signal}) => {
          const field1 = form.getField('formfield1');
          const field2 = form.getField('formfield2');
          expect(field1.get()).to.equal('stop2');
          expect(field2.get()).to.be.undefined();

          field2.set('resume');

          signal(form.getOutput());
        });

        listener.on('wait-task', ({signal}) => {
          signal();
        });

        Engine.resume(state, {listener}, done);
      });
    });

  });

  describe('formKey', () => {
    it('start event emits wait', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testFormKey" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" camunda:formKey="form1" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        activityApi.signal({ key: activityApi.formKey });
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput()).to.equal({
          key: 'form1'
        });
        done();
      });

      engine.execute({
        listener,
        variables: {}
      });
    });

    it('sets key value with expression', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testFormKey" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" camunda:formKey="\${variables.inputForm}" />
          <userTask id="task" camunda:formKey="\${variables.inputForm}" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        expect(activityApi.formKey).to.equal('form1');
        activityApi.signal({ inputForm: 'form2' });
      });
      listener.once('wait-task', (activityApi) => {
        activityApi.signal({ key: activityApi.formKey });
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput()).to.equal({
          inputForm: 'form2',
          taskInput: {
            task: {key: 'form2'}
          }
        });
        done();
      });

      engine.execute({
        listener,
        variables: {
          inputForm: 'form1'
        }
      });
    });
  });
});
