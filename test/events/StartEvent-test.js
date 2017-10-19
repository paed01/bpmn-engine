'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe('StartEvent', () => {
  describe('behaviour', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start">
          <extensionElements>
            <camunda:InputOutput>
              <camunda:inputParameter name="data">\${variables.statusCode}</camunda:inputParameter>
            </camunda:InputOutput>
          </extensionElements>
        </startEvent>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(source, moddleOptions, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    it('has outbound', (done) => {
      const event = context.getChildActivityById('start');
      expect(event.outbound).to.have.length(1);
      done();
    });

    it('supports io', (done) => {
      const event = context.getChildActivityById('start');
      expect(event.io).to.exist();
      done();
    });

    it('exection getInput() returns io input', (done) => {
      context.environment.assignVariables({statusCode: 200});

      const event = context.getChildActivityById('start');
      event.once('end', (activity, executionContext) => {
        expect(executionContext.getInput()).to.equal({
          data: 200
        });

        done();
      });

      event.activate();
      event.run();
    });

    it('emits events in expected sequence', (done) => {
      const event = context.getChildActivityById('start');
      const sequence = [];

      event.on('enter', (a, b) => {
        expect(a.id).to.equal(b.id);
        sequence.push('enter');
      });
      event.on('start', (a, b) => {
        expect(a.id).to.equal(b.id);
        sequence.push('start');
      });
      event.on('end', (a, b) => {
        expect(a.id).to.equal(b.id);
        sequence.push('end');
      });
      event.on('leave', (a, b) => {
        expect(a.id).to.equal(b.id);
        sequence.push('leave');
        expect(sequence).to.equal(['enter', 'start', 'end', 'leave']);
        done();
      });

      event.run();
    });
  });

  describe('with form', () => {
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
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
      </process>
    </definitions>`;

    it('requires signal to start', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-start', (activityApi) => {
        expect(activityApi.getState().waiting).to.be.true();
        activityApi.signal({
          formfield1: 1,
          formfield2: 2
        });
      });

      const engine = new Engine({
        source,
        moddleOptions
      });

      engine.once('end', (exection) => {
        expect(exection.getOutput()).to.equal({
          formfield1: 1,
          formfield2: 2
        });
        done();
      });

      engine.execute({
        listener
      });
    });

    it('getState() returns waiting true', (done) => {
      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();

      listener.once('wait-start', (activity) => {
        engine.stop();
        expect(activity.getState()).to.include({ waiting: true });
        done();
      });

      engine.execute({
        listener
      });
    });

    it('getState() returns form state', (done) => {
      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (event) => {
        engine.stop();
        const state = event.getState();
        expect(state.io).to.include(['form']);
        expect(state.io.form).to.include(['fields']);
        done();
      });

      engine.execute({
        listener
      });
    });
  });

  describe('with formKey', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" camunda:formKey="startForm" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
      </process>
    </definitions>`;

    it('requires signal to start', (done) => {
      const listener = new EventEmitter();

      listener.once('wait-start', (activityApi) => {
        expect(activityApi.getState().waiting).to.be.true();
        activityApi.signal({
          formfield1: 1,
          formfield2: 2
        });
      });

      const engine = new Engine({
        source,
        moddleOptions
      });

      engine.once('end', (execution) => {
        expect(execution.getOutput()).to.equal({
          formfield1: 1,
          formfield2: 2
        });
        done();
      });

      engine.execute({
        listener
      });
    });
  });

  describe('with MessageEventDefinition', () => {
    it('assigns output to environment variables', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start">
            <messageEventDefinition />
          </startEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        activityApi.signal({signal: 'START'});
      });

      listener.once('end-start', (activityApi) => {
        expect(activityApi.getOutput()).to.equal({signal: 'START'});
      });

      engine.execute({
        listener
      });
      engine.once('end', (exection) => {
        expect(exection.getOutput()).to.equal({
          taskInput: {
            start: {
              signal: 'START'
            }
          }
        });
        done();
      });
    });

    it('and input/output assigns output to environment variables', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start">
            <messageEventDefinition />
            <extensionElements>
              <camunda:InputOutput>
                <camunda:outputParameter name="signal">\${signal}</camunda:outputParameter>
              </camunda:InputOutput>
            </extensionElements>
          </startEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        moddleOptions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        activityApi.signal({signal: 'START'});
      });

      engine.execute({
        listener
      });
      engine.once('end', (exection) => {
        expect(exection.getOutput()).to.include({
          signal: 'START'
        });
        done();
      });
    });

  });
});
