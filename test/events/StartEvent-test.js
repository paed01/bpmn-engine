'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

const extensions = {
  js: require('../resources/JsExtension')
};

describe('StartEvent', () => {
  describe('behaviour', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach(async () => {
      context = await testHelpers.context(source);
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
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" js:formKey="testForm" />
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
        extensions
      });

      engine.once('end', (exection) => {
        expect(exection.getOutput().taskInput.start).to.equal({
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
        extensions
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
        extensions
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (event) => {
        engine.stop();
        const state = event.getState();
        expect(state).to.include(['form']);
        expect(state.form.key).to.equal('testForm');
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
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start">
            <messageEventDefinition />
          </startEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source
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
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start">
            <messageEventDefinition />
          </startEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (activityApi) => {
        activityApi.signal({signal: 'START'});
      });

      engine.execute({
        listener
      });
      engine.once('end', (exection) => {
        expect(exection.getOutput().taskInput.start).to.include({
          signal: 'START'
        });
        done();
      });
    });

  });
});
