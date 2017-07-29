'use strict';

const {Engine} = require('../../.');
const EventEmitter = require('events').EventEmitter;
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('IoSpecification', () => {
  describe('behaviour', () => {
    let context;
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="testIoSpec" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="inputRef" dataObjectRef="input" />
        <dataObjectReference id="staticRef" dataObjectRef="static" />
        <dataObjectReference id="surnameRef" dataObjectRef="surname" />
        <dataObjectReference id="givenNameRef" dataObjectRef="givenName" />
        <dataObject id="input" />
        <dataObject id="static" />
        <dataObject id="surname" />
        <dataObject id="givenName" />
        <startEvent id="theStart" />
        <userTask id="task1">
          <ioSpecification id="inputSpec1">
            <dataInput id="input_1" name="input" />
            <dataInput id="staticField" name="static" />
            <dataOutput id="surnameInput" />
            <inputSet id="inputSet_1">
              <dataInputRefs>input_1</dataInputRefs>
              <dataInputRefs>staticField</dataInputRefs>
            </inputSet>
          </ioSpecification>
          <dataInputAssociation id="associatedInput" sourceRef="input_1" targetRef="inputRef" />
          <dataInputAssociation id="associatedStatic" sourceRef="staticField" targetRef="staticRef" />
          <dataOutputAssociation id="associatedOutput" sourceRef="surnameInput" targetRef="surnameRef" />
        </userTask>
        <userTask id="task2">
          <ioSpecification id="inputSpec2">
            <dataInput id="input_2" name="age" />
            <dataInput id="input_3" name="surname" />
            <dataOutput id="givenNameField" name="givenName" />
            <dataOutput id="ageField" name="age" />
            <outputSet id="outputSet_2">
              <dataOutputRefs>givenNameField</dataOutputRefs>
              <dataOutputRefs>ageField</dataOutputRefs>
            </outputSet>
          </ioSpecification>
          <dataInputAssociation id="associatedInput_2" sourceRef="input_2" targetRef="inputRef" />
          <dataInputAssociation id="associatedInput_3" sourceRef="input_3" targetRef="surnameRef" />
          <dataOutputAssociation id="associatedOutput_2" sourceRef="givenNameField" targetRef="givenNameRef" />
          <dataOutputAssociation id="associatedOutput_3" sourceRef="ageField" targetRef="inputRef" />
        </userTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="task1" />
        <sequenceFlow id="flow2" sourceRef="task1" targetRef="task2" />
        <sequenceFlow id="flow3" sourceRef="task2" targetRef="theEnd" />
      </process>
    </definitions>`;

    beforeEach((done) => {
      testHelpers.getContext(source, {}, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('input set is available to activity', (done) => {
      context.environment.assignVariables({
        input: 'START'
      });

      const task = context.getChildActivityById('task1');

      task.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        expect(api.getInput()).to.equal({
          input: 'START'
        });
        done();
      });

      task.activate().run();
    });

    it('output is available to activity', (done) => {
      const task = context.getChildActivityById('task1');

      task.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        api.signal('von Rosen');
      });

      task.on('end', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        expect(api.getOutput()).to.equal({
          surnameInput: 'von Rosen'
        });
        done();
      });

      task.activate().run();
    });

    it('set output is ignored if input is not an object', (done) => {
      const task = context.getChildActivityById('task2');

      task.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        api.signal(false);
      });

      task.on('end', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        expect(api.getOutput()).to.be.empty();
        done();
      });

      task.activate().run();
    });

    it('environment variables are set on end', (done) => {
      const engine = new Engine({
        source
      });

      const listener = new EventEmitter();
      listener.on('wait-task1', (activityApi) => {
        activityApi.signal('von Rosen');
      });
      listener.on('wait-task2', (activityApi) => {
        expect(activityApi.getInput()).to.equal({
          age: 42,
          surname: 'von Rosen'
        });
        activityApi.signal({
          givenName: ['Martin', 'Pål'],
          age: 43
        });
      });

      engine.execute({
        listener,
        variables: {
          input: 42
        }
      });

      engine.on('end', (e, def) => {
        expect(def.environment.getOutput()).to.equal({
          input: 43,
          surname: 'von Rosen',
          givenName: ['Martin', 'Pål']
        });
        done();
      });
    });
  });
});
