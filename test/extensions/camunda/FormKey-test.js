'use strict';

const Lab = require('lab');
const {Engine} = require('../../../.');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

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
      activityApi.form.setFieldValue('key', activityApi.form.id);
      activityApi.signal();
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
        <userTask id="task" camunda:formKey="\${formKey}">
          <extensionElements>
            <camunda:InputOutput>
              <camunda:inputParameter name="formKey">MyForm</camunda:inputParameter>
              <camunda:outputParameter name="key">\${key}</camunda:outputParameter>
            </camunda:InputOutput>
          </extensionElements>
        </userTask>
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
        key: 'MyForm'
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

  it('resumes with resolved formKey value', (done) => {
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

    let listener = new EventEmitter();
    listener.once('wait-start', (activityApi) => {
      expect(activityApi.formKey).to.equal('input');
      engine.stop();
    });

    engine.execute({
      listener,
      variables: {
        inputForm: 'input'
      }
    });

    engine.on('end', () => {
      const state = engine.getState();
      listener = new EventEmitter();

      listener.on('wait-start', ({formKey, signal}) => {
        signal(`start-${formKey}`);
      });

      listener.on('wait-task', ({formKey, signal}) => {
        signal(`user-${formKey}`);
      });

      Engine.resume(state, {listener}, (err, execution) => {
        if (err) return done(err);
        expect(execution.getOutput()).to.equal({
          result: 'user-input'
        });
        done();
      });
    });
  });
});
