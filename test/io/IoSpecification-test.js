'use strict';

const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../.');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('IoSpecification', () => {
  it('activity output only', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
        <dataObject id="inputFromUser" />
        <startEvent id="theStart" />
        <userTask id="userTask">
          <ioSpecification id="inputSpec">
            <dataOutput id="userInput" name="signal" />
          </ioSpecification>
          <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
        </userTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
        <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
      </process>
    </definitions>`;

    const engine = new Engine({
      source
    });

    const listener = new EventEmitter();
    listener.on('wait-userTask', (activityApi) => {
      expect(activityApi.getInput()).to.equal({});
      activityApi.signal({signal: 'no input'});
    });

    engine.execute({listener}, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.equal({
        inputFromUser: 'no input'
      });
      done();
    });
  });

  it('activity input only - ignores output', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="inputToUserRef" dataObjectRef="userInfo" />
        <dataObject id="userInfo" />
        <startEvent id="theStart" />
        <userTask id="userTask">
          <ioSpecification id="inputSpec">
            <dataInput id="userInput" name="info" />
          </ioSpecification>
          <dataInputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputToUserRef" />
        </userTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
        <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
      </process>
    </definitions>`;

    const engine = new Engine({
      source
    });

    const listener = new EventEmitter();
    listener.on('wait-userTask', (activityApi) => {
      expect(activityApi.getInput()).to.equal({
        info: 'this is how'
      });
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.equal({});
      done();
    });
  });

  it('no data objects effectively ignores io', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <userTask id="userTask">
          <ioSpecification id="inputSpec">
            <dataInput id="userInput" name="info" value="lkJH">user info</dataInput>
          </ioSpecification>
        </userTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
        <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
      </process>
    </definitions>`;

    const engine = new Engine({
      source
    });

    const listener = new EventEmitter();
    listener.on('wait-userTask', (activityApi) => {
      expect(activityApi.getInput()).to.equal({});
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.equal({});
      done();
    });
  });

  it('association missing target', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <userTask id="userTask">
          <ioSpecification id="inputSpec">
            <dataInput id="userInput" name="info" />
          </ioSpecification>
          <dataInputAssociation id="associatedWith" sourceRef="userInput" />
        </userTask>
        <endEvent id="theEnd" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
        <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
      </process>
    </definitions>`;

    const engine = new Engine({
      source
    });

    const listener = new EventEmitter();
    listener.on('wait-userTask', (activityApi) => {
      expect(activityApi.getInput()).to.equal({});
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.equal({});
      done();
    });
  });

  it('getInput() dataObjectReference missing target returns empty input', (done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="userInfoRef" />
        <dataObject id="userInfo" />
        <userTask id="userTask">
          <ioSpecification id="inputSpec">
            <dataInput id="infoToUser" name="info" />
          </ioSpecification>
          <dataInputAssociation id="associatedWith" sourceRef="infoToUser" targetRef="userInfoRef" />
        </userTask>
      </process>
    </definitions>`;

    const engine = new Engine({
      source
    });

    const listener = new EventEmitter();
    listener.on('wait-userTask', (activityApi) => {
      expect(activityApi.getInput()).to.equal({});
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.equal({});
      done();
    });
  });

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
            <dataOutput id="surnameInput" name="surname" />
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
        api.signal({surname: 'von Rosen'});
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

    it('set output is ignored if task input is not an object', (done) => {
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

    it('set output value is ignored if no output reference', (done) => {
      const task = context.getChildActivityById('task2');

      task.on('wait', (activityApi, executionContext) => {
        executionContext.getIo().setOutputValue('no-ref', 'save me');

        const api = activityApi.getApi(executionContext);
        api.signal();
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
        activityApi.signal({surname: 'von Rosen'});
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
