'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('StartEvent', () => {
  it('should have outbound sequence flows', (done) => {
    const processXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
      </process>
    </definitions>`;

    const engine = new Engine({
      source: processXml
    });
    engine.execute((err, execution) => {
      if (err) return done(err);
      expect(execution.getChildActivityById('start')).to.include('outbound');
      done();
    });
  });

  describe('with form', () => {
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
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        listener: listener
      });
    });

    it('getState() returns waiting true', (done) => {
      const engine = new Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();

      listener.once('wait-start', (activity) => {
        engine.stop();
        expect(activity.getState()).to.include({ waiting: true });
        done();
      });

      engine.execute({
        listener: listener
      });
    });

    it('getState() returns form state', (done) => {
      const engine = new Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.once('wait-start', (event) => {
        engine.stop();
        const state = event.getState();
        expect(state).to.include(['form']);
        expect(state.form).to.include(['fields']);
        done();
      });

      engine.execute({
        listener: listener
      });
    });
  });
});
