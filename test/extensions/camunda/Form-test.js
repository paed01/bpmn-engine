'use strict';

const factory = require('../../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../../helpers/testHelpers');
const {Engine} = require('../../../.');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('Forms', () => {
  describe('behaviour', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start">
          <extensionElements>
            <camunda:formData />
          </extensionElements>
        </startEvent>
        <userTask id="task">
          <extensionElements>
            <camunda:formData>
              <camunda:formField id="input" label="\${variables.label}" defaultValue="\${input}" />
            </camunda:formData>
            <camunda:InputOutput>
              <camunda:inputParameter name="input">\${variables.input}</camunda:inputParameter>
            </camunda:InputOutput>
          </extensionElements>
        </userTask>
        <userTask id="task2">
          <extensionElements>
            <camunda:formData>
              <camunda:formField id="input" label="\${variables.label}" />
            </camunda:formData>
          </extensionElements>
        </userTask>
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(source, moddleOptions, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('has access to variables and activity input when assigning label and default value', (done) => {
      const activity = context.getChildActivityById('task');
      context.environment.set('input', 1);
      context.environment.set('label', 'field label');

      activity.on('enter', (activityApi, activityExecution) => {
        const form = activityExecution.getForm();
        const field = form.getField('input');

        expect(field.label, 'label').to.equal('field label');
        expect(field.get(), 'value').to.equal(1);
        done();
      });

      activity.activate().run();
    });

    it('assigned field value is returned in form output', (done) => {
      const activity = context.getChildActivityById('task');
      context.environment.set('input', -1);
      context.environment.set('label', 'field label');

      activity.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        const fields = api.form.getFields();
        fields.forEach(({set}, idx) => set(idx * 10));
        api.signal();
      });

      activity.on('end', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        expect(api.form.getOutput()).to.equal({
          input: 0
        });
        done();
      });

      activity.activate().run();
    });

    it('without fields ignores form', (done) => {
      const activity = context.getChildActivityById('start');
      expect(activity.form).to.be.undefined();
      activity.on('enter', (activityApi, executionContext) => {
        const activeForm = executionContext.getForm();
        expect(activeForm).to.be.undefined();
        done();
      });
      activity.activate().run();
    });

    it('setFieldValue() of unknown field is ignored', (done) => {
      const activity = context.getChildActivityById('task');
      context.environment.set('input', 1);

      activity.on('enter', (activityApi, executionContext) => {
        const activeForm = executionContext.getForm();
        activeForm.setFieldValue('arb', 2);
        expect(activeForm.getOutput()).to.equal({input: 1});
        done();
      });

      activity.activate().run();
    });

    it('reset() resets fields to default value', (done) => {
      const activity = context.getChildActivityById('task');
      context.environment.set('input', 1);

      activity.on('enter', (activityApi, executionContext) => {
        const activeForm = executionContext.getForm();
        activeForm.setFieldValue('input', 2);
      });

      activity.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        api.form.reset();
        api.signal();
      });

      activity.on('end', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        expect(api.form.getOutput()).to.equal({
          input: 1
        });
        done();
      });

      activity.activate().run();
    });

    it('assigns form output to environment if activity has default io', (done) => {
      const activity = context.getChildActivityById('task2');

      activity.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        api.form.setFieldValue('input', 2);
        api.signal();
      });

      activity.on('leave', (activityApi, executionContext) => {
        executionContext.save();
        expect(context.environment.getOutput()).to.equal({
          input: 2
        });
        done();
      });

      activity.activate().run();
    });
  });

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
      const engine = new Engine({
        source: factory.resource('forms.bpmn'),
        moddleOptions
      });

      const listener = new EventEmitter();

      listener.once('wait-start', (activityApi) => {
        const fields = activityApi.form.getFields();

        expect(fields[0]).to.include({
          defaultValue: new Date('2017-02-05')
        });

        fields[0].set(new Date('2017-02-06'));

        activityApi.signal();
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

      engine.execute({
        listener,
        variables: {
          now: new Date('2017-02-05')
        }
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput()).to.include({
          startDate: new Date('2017-02-07')
        });
        done();
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
              <camunda:formField id="formfield2" label="FormField2" type="long" />
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

    it('returns form fields', (done) => {
      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        engine.stop();
        const state = activityApi.getState().io.form;
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

    it('resume fields ignores missing state', (done) => {
      testHelpers.getContext(source, moddleOptions, (err, context) => {
        if (err) return done(err);

        const activity = context.getChildActivityById('task');
        let state;
        activity.once('wait', (activityApi, executionContext) => {
          const api = activityApi.getApi(executionContext);
          api.form.setFieldValue('surname', 'Edman');
          state = api.getState();

          state.io.form.fields.splice(1, 1);
          state.io.form.fields.push({
            id: 'arb'
          });
          api.stop();

          activity.on('wait', (resumedActivityApi, resumedExecutionContext) => {
            const resumedApi = resumedActivityApi.getApi(resumedExecutionContext);

            expect(resumedApi.form.getFieldValue('arb')).to.be.undefined();
            expect(resumedApi.form.getFieldValue('surname')).to.equal('Edman');

            done();
          });

          activity.activate(state).resume();
        });

        activity.activate().run();
      });
    });
  });
});
