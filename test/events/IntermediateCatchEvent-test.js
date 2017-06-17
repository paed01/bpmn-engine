'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const EventEmitter = require('events').EventEmitter;

lab.experiment('Intermediate Catch Event', () => {
  lab.describe('behaviour', () => {
    let context;
    lab.beforeEach((done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <startEvent id="start" />
          <intermediateCatchEvent id="timeoutEvent">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT0.01S</timeDuration>
            </timerEventDefinition>
          </intermediateCatchEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="timeoutEvent" />
          <sequenceFlow id="flow2" sourceRef="timeoutEvent" targetRef="end" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    lab.test('loads event definitions on activate', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      const eventApi = event.activate();

      const boundEvents = eventApi.getEvents();
      expect(boundEvents).to.have.length(1);

      expect(boundEvents[0]).to.include({
        id: 'timeoutEvent',
        type: 'bpmn:TimerEventDefinition',
        duration: 'PT0.01S',
        cancelActivity: true
      });

      done();
    });

    lab.test('resolves timeout when inbound is taken', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.on('start', (activity) => {
        activity.stop();
        expect(activity.getState().timeout).to.equal(10);
        done();
      });

      event.activate();
      event.inbound[0].take();
    });

    lab.test('returns expected state on start', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.on('start', (activity) => {
        activity.stop();
        expect(activity.getState()).to.equal({
          id: 'timeoutEvent',
          type: 'bpmn:IntermediateCatchEvent',
          timeout: 10,
          duration: 10,
          entered: true
        });
        done();
      });

      event.activate();
      event.inbound[0].take();
    });

    lab.test('resolves duration expression when executed', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <userTask id="dontWaitForMe" />
          <boundaryEvent id="timeoutEventWithVar" attachedToRef="dontWaitForMe">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT\${variables.timeout}S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context2) => {
        if (err) return done(err);

        context2.variablesAndServices.variables = {
          timeout: 0.2
        };

        const event = context2.getChildActivityById('timeoutEventWithVar');

        event.once('start', (activity) => {
          activity.stop();
          expect(activity.getState().timeout).to.equal(200);
          done();
        });

        event.run();
      });
    });

    lab.test('emits end when timed out', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', () => {
        done();
      });

      event.inbound[0].take();
    });

    lab.test('discards outbound if inbound was discarded', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.outbound[0].once('discarded', () => {
        done();
      });

      event.activate();
      event.inbound.forEach((f) => f.discard());
    });
  });

  lab.describe('TimerEventDefinition', () => {
    lab.test('waits duration', (done) => {
      const engine = new Bpmn.Engine({
        source: factory.resource('timer-event.bpmn')
      });
      const listener = new EventEmitter();

      const calledEnds = [];
      listener.on('end', (e) => {
        calledEnds.push(e.id);
      });

      engine.execute({
        listener: listener
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(calledEnds).to.include(['task1', 'duration', 'task2']);
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });
  });
});
