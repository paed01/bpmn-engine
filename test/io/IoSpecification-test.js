'use strict';

const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../.');
const {EventEmitter} = require('events');

const moddleOptions = {
  js: require('../resources/js-bpmn-moddle.json')
};

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
      expect(activityApi.getInput()).to.eql({});
      activityApi.signal({signal: 'no input'});
    });

    engine.execute({listener}, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.eql({
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
      expect(activityApi.getInput()).to.eql({
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
      expect(execution.getOutput()).to.eql({});
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
      expect(activityApi.getInput()).to.eql({});
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.eql({});
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
      expect(activityApi.getInput()).to.eql({});
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.eql({});
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
      expect(activityApi.getInput()).to.eql({});
      activityApi.signal('no input');
    });

    engine.execute({
      listener,
      variables: {
        userInfo: 'this is how'
      }
    }, (err, execution) => {
      if (err) done(err);
      expect(execution.getOutput()).to.eql({});
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

    beforeEach(async () => {
      context = await testHelpers.context(source);
    });

    it('input set is available to activity', (done) => {
      context.environment.assignVariables({
        input: 'START'
      });

      const task = context.getChildActivityById('task1');

      task.on('wait', (activityApi, executionContext) => {
        const api = activityApi.getApi(executionContext);
        expect(api.getInput()).to.eql({
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
        expect(api.getOutput()).to.eql({
          surname: 'von Rosen'
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
        expect(api.getOutput()).to.eql({});
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
        expect(api.getOutput()).to.eql({});
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
        expect(activityApi.getInput()).to.eql({
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
        expect(def.environment.getOutput()).to.eql({
          input: 43,
          surname: 'von Rosen',
          givenName: ['Martin', 'Pål']
        });
        done();
      });
    });
  });

  describe('loop', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="testIoSpec" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="inputRef" dataObjectRef="input" />
        <dataObjectReference id="staticRef" dataObjectRef="static" />
        <dataObjectReference id="ageRef" dataObjectRef="age" />
        <dataObjectReference id="givenNameRef" dataObjectRef="givenName" />
        <dataObject id="input" />
        <dataObject id="static" />
        <dataObject id="age" />
        <dataObject id="givenName" />
        <userTask id="task-io-loop">
          <multiInstanceLoopCharacteristics isSequential="false" js:collection="\${variables.list}">
            <completionCondition xsi:type="tFormalExpression">\${services.condition(index)}</completionCondition>
            <loopCardinality xsi:type="tFormalExpression">3</loopCardinality>
          </multiInstanceLoopCharacteristics>
          <ioSpecification id="inputSpec2">
            <dataInput id="input_item" name="item" />
            <dataInput id="input_index" name="index" />
            <dataInput id="input_age" name="age" />
            <dataOutput id="givenNameField" name="field_givename" />
            <dataOutput id="ageField" name="field_age" />
            <outputSet id="outputSet_2">
              <dataOutputRefs>givenNameField</dataOutputRefs>
              <dataOutputRefs>ageField</dataOutputRefs>
            </outputSet>
          </ioSpecification>
          <dataInputAssociation id="associatedInput_3" sourceRef="input_age" targetRef="ageRef" />
          <dataOutputAssociation id="associatedOutput_2" sourceRef="givenNameField" targetRef="givenNameRef" />
          <dataOutputAssociation id="associatedOutput_3" sourceRef="ageField" targetRef="inputRef" />
        </userTask>
      </process>
    </definitions>`;

    let context;
    beforeEach(async () => {
      context = await testHelpers.context(source, {moddleOptions});
    });

    it('io is loop aware', (done) => {
      context.environment.set('input', 1);
      context.environment.set('static', 2);
      context.environment.set('list', [{
        item: 'a'
      }, {
        item: 'b'
      }]);

      const activity = context.getChildActivityById('task-io-loop');
      activity.on('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        expect(activityExecution.getIo().isLoopContext).to.be.true;
        api.signal();
      });

      activity.on('end', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        if (!api.loop) return;
        done();
      });

      activity.activate().run();
    });

    it('resolves input per iteration', (done) => {
      const list = [{
        item: 'a'
      }, {
        item: 'b'
      }, {
        item: 'c'
      }, {
        item: 'd'
      }];
      context.environment.set('age', 1);
      context.environment.set('surname', 'von Rosen');
      context.environment.set('list', list);

      const activity = context.getChildActivityById('task-io-loop');
      activity.on('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);

        const input = api.getInput();

        expect(input).to.include({
          age: 1,
          index: input.index,
          item: list[input.index]
        });
        api.signal();
      });

      activity.on('end', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        if (!api.loop) return;
        done();
      });

      activity.activate().run();
    });

    it('ioSpecification saves result on iteration end', (done) => {
      const list = [{
        item: 'a'
      }, {
        item: 'b'
      }, {
        item: 'c'
      }, {
        item: 'd'
      }];

      context.environment.set('list', list);

      const activity = context.getChildActivityById('task-io-loop');
      activity.on('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        const {index} = api.getInput();
        api.signal({
          field_item: `item ${index}`,
          field_age: index,
          field_givename: `Jr ${index}`
        });
      });

      activity.on('end', (activityApi, activityExecution) => {
        if (activityExecution.isLoopContext) {
          const {index} = activityExecution.getInput();
          expect(activityExecution.getOutput()).to.eql({
            field_givename: `Jr ${index}`,
            field_age: index
          });
        }
      });

      activity.on('leave', (activityApi, activityExecution) => {
        activityExecution.save();
        expect(context.environment.getOutput()).to.eql({
          givenName: [ 'Jr 0', 'Jr 1', 'Jr 2' ],
          input: [ 0, 1, 2 ]
        });

        done();
      });

      activity.activate().run();
    });

  });
});
