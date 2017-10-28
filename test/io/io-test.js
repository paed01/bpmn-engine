'use strict';

const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('io', () => {
  describe('behavior', () => {
    let context;
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="testIoSpec" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
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
        <userTask id="task-form-only">
          <extensionElements>
            <camunda:formData>
              <camunda:formField id="field_surname" label="\${variables.surnameLabel}" defaultValue="\${variables.surname}" />
            </camunda:formData>
          </extensionElements>
        </userTask>
        <userTask id="task-io-combo">
          <extensionElements>
            <camunda:InputOutput>
              <camunda:inputParameter name="input">\${variables.input}</camunda:inputParameter>
              <camunda:outputParameter name="result">\${signal}</camunda:outputParameter>
            </camunda:InputOutput>
          </extensionElements>
          <ioSpecification id="inputSpec1">
            <dataInput id="input_1" name="input" />
            <dataInput id="staticField" name="static" />
            <dataOutput id="signalOutput" name="signal" />
            <inputSet id="inputSet_1">
              <dataInputRefs>input_1</dataInputRefs>
              <dataInputRefs>staticField</dataInputRefs>
            </inputSet>
          </ioSpecification>
          <dataInputAssociation id="associatedInput" sourceRef="input_1" targetRef="inputRef" />
          <dataInputAssociation id="associatedStatic" sourceRef="staticField" targetRef="staticRef" />
          <dataOutputAssociation id="associatedOutput" sourceRef="signalOutput" targetRef="surnameRef" />
        </userTask>
        <userTask id="task-io-form-combo">
          <extensionElements>
            <camunda:formData>
              <camunda:formField id="field_age" label="\${surname} age" defaultValue="\${variables.input}" />
              <camunda:formField id="field_givename" label="Before \${surname}" defaultValue="\${variables.givenName}" />
            </camunda:formData>
          </extensionElements>
          <ioSpecification id="inputSpec2">
            <dataInput id="input_2" name="age" />
            <dataInput id="input_3" name="surname" />
            <dataOutput id="givenNameField" name="field_givename" />
            <dataOutput id="ageField" name="field_age" />
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
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="task-form-only" />
        <sequenceFlow id="flow2" sourceRef="task-form" targetRef="task-io-spec" />
        <sequenceFlow id="flow3" sourceRef="task-io-combo" targetRef="task-io-combo-form" />
        <sequenceFlow id="flow4" sourceRef="task-io-combo-form" targetRef="theEnd" />
      </process>
    </definitions>`;

    beforeEach((done) => {
      testHelpers.getContext(source, moddleOptions, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    describe('no specified io', () => {
      it('returns empty input and output', (done) => {
        const activity = context.getChildActivityById('theStart');
        context.environment.set('input', 1);
        context.environment.set('static', 2);

        activity.on('enter', (activityApi, activityExecution) => {
          expect(activityExecution.getInput()).to.be.undefined();
        });
        activity.on('end', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(api.getOutput()).to.be.undefined();
          done();
        });

        activity.activate().run();
      });
    });

    describe('with form only', () => {
      it('saves form data to environment', (done) => {
        const activity = context.getChildActivityById('task-form-only');
        context.environment.set('input', 1);
        context.environment.set('static', 2);
        context.environment.set('surnameLabel', 'Surname?');

        activity.on('wait', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(api.form).to.exist();
          expect(api.form.getFields()).to.have.length(1);

          expect(api.form.getField('field_surname').label).to.equal('Surname?');
          expect(api.form.getField('field_surname').defaultValue).to.be.undefined();

          api.form.setFieldValue('field_surname', 'Edman');

          api.signal();
        });

        activity.on('end', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(api.getOutput()).to.equal({
            field_surname: 'Edman'
          });

          activityExecution.save();
          expect(context.environment.getOutput()).to.equal({
            field_surname: 'Edman'
          });

          done();
        });

        activity.activate().run();
      });
    });

    describe('combined io', () => {
      it('returns expected input and output', (done) => {
        const activity = context.getChildActivityById('task-io-combo');
        context.environment.set('input', 1);
        context.environment.set('static', 2);

        activity.on('wait', (activityApi, activityExecution) => {
          expect(activityExecution.getInput()).to.equal({
            input: 1,
            static: 2
          });

          activityExecution.signal({
            signal: 'a'
          });
        });

        activity.on('end', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(api.getOutput()).to.equal({
            result: 'a',
            signalOutput: 'a'
          });

          activityExecution.save();
          expect(context.environment.getOutput()).to.equal({
            result: 'a',
            surname: 'a'
          });

          done();
        });

        activity.activate().run();
      });

      it.skip('with form only set form properties', (done) => {
        const activity = context.getChildActivityById('task-io-form-combo');
        context.environment.set('input', 1);
        context.environment.set('static', 2);
        context.environment.set('surname', 'Edman');

        activity.on('wait', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(activityExecution.getInput()).to.equal({
            age: 1,
            surname: 'Edman',
            field_age: 1,
            field_givename: undefined,
          });

          const field1 = api.form.getField('field_age');
          expect(field1.defaultValue).to.equal(1);
          expect(field1.label).to.equal('Edman age');

          const field2 = api.form.getField('field_givename');
          expect(field2.defaultValue).to.be.undefined();
          expect(field2.label).to.equal('Before Edman');

          api.form.setFieldValue('field_age', 2);
          api.form.setFieldValue('field_givename', 'P');

          activityExecution.signal();
        });

        activity.on('end', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);

          expect(api.getOutput()).to.equal({
            givenNameField: 'P',
            ageField: 2
          });

          activityExecution.save();
          expect(context.environment.getOutput()).to.equal({
            input: 2,
            givenName: 'P'
          });

          done();
        });

        activity.activate().run();
      });
    });

    describe('getState()', () => {
      it('returns state per io', (done) => {
        const activity = context.getChildActivityById('task-io-combo');
        context.environment.set('input', 1);
        context.environment.set('static', 2);

        let state;
        activity.on('wait', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          state = api.getState();
          api.stop();

          expect(state.io, 'io').to.exist();
          expect(state.io.ioSpecification, 'io.ioSpecification').to.exist();
          expect(state.io.ioSpecification).to.equal({
            input: {
              input: 1,
              static: 2
            }
          });

          done();
        });
        activity.activate().run();
      });
    });

    describe('resume()', () => {
      it('resumes state per io', (done) => {
        const activity = context.getChildActivityById('task-io-combo');
        context.environment.set('input', 1);
        context.environment.set('static', 2);

        activity.on('wait', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          const state = api.getState();
          api.stop();

          const clonedContext = context.clone();
          context.environment.set('input', 'a');
          clonedContext.environment.set('static', 3);
          const resumedActivity = clonedContext.getChildActivityById('task-io-combo');

          const resumed = resumedActivity.activate(state);
          resumedActivity.on('wait', (resumedActivityApi, resumedExecution) => {
            const resumedApi = resumedActivityApi.getApi(resumedExecution);
            expect(resumedApi.getInput()).to.equal({
              input: 1,
              static: 2
            });

            done();
          });

          resumed.resume();
        });
        activity.activate().run();
      });
    });

  });

  describe('loop', () => {
    let context;
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="testIoSpec" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
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
          <multiInstanceLoopCharacteristics isSequential="false" camunda:collection="\${variables.list}">
            <completionCondition xsi:type="tFormalExpression">\${services.condition(index)}</completionCondition>
            <loopCardinality xsi:type="tFormalExpression">3</loopCardinality>
          </multiInstanceLoopCharacteristics>
          <extensionElements>
            <camunda:formData>
              <camunda:formField id="field_item" label="\${item.item}" />
              <camunda:formField id="field_age" label="\${variables.surname} age" defaultValue="\${index}" />
              <camunda:formField id="field_givename" label="Before \${variables.surname}" defaultValue="\${givenName}" />
            </camunda:formData>
          </extensionElements>
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

    beforeEach((done) => {
      testHelpers.getContext(source, moddleOptions, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
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
        expect(activityExecution.getIo().isLoopContext).to.be.true();
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

    it('resolves form per iteration', (done) => {
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

        const {index} = api.getInput();

        const {getField} = api.form;
        expect(getField('field_item').label).to.equal(list[index].item);
        expect(getField('field_item').defaultValue).to.be.undefined();
        expect(getField('field_age').label).to.equal('von Rosen age');
        expect(getField('field_age').defaultValue).to.equal(index);
        expect(getField('field_givename').label).to.equal('Before von Rosen');
        expect(getField('field_givename').defaultValue).to.be.undefined();

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

        const {setFieldValue} = api.form;

        setFieldValue('field_item', `item ${index}`);
        setFieldValue('field_age', index);
        setFieldValue('field_givename', `Jr ${index}`);

        api.signal();
      });

      activity.on('leave', (activityApi, activityExecution) => {
        if (activityExecution.isLoopContext) return;

        activityExecution.save();
        expect(context.environment.getOutput()).to.equal({
          givenName: [ 'Jr 0', 'Jr 1', 'Jr 2' ],
          input: [ 0, 1, 2 ]
        });

        done();
      });

      activity.activate().run();
    });

  });
});
