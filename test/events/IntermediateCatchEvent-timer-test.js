'use strict';

const ck = require('chronokinesis');
const factory = require('../helpers/factory');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../../lib');
const {EventEmitter} = require('events');

describe('IntermediateCatchEvent with timer', () => {
  describe('behaviour', () => {
    let context;
    beforeEach(async () => {
      const source = `
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

      context = await testHelpers.context(source);
    });
    afterEach(ck.reset);

    it('loads event definitions on activate', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      const eventApi = event.activate();

      const boundEvents = eventApi.getEvents();
      expect(boundEvents).to.have.length(1);

      expect(boundEvents[0]).to.include({
        id: 'timeoutEvent',
        type: 'bpmn:TimerEventDefinition',
        duration: 'PT0.01S'
      });

      done();
    });

    it('resolves timeout when inbound is taken', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.on('start', (activityApi, executionContext) => {
        activityApi.stop();
        expect(activityApi.getApi(executionContext).getState().duration).to.equal(10);
        done();
      });

      event.activate();
      event.inbound[0].take();
    });

    it('returns expected state on start', (done) => {
      ck.freeze();
      const startedAt = new Date();
      const event = context.getChildActivityById('timeoutEvent');

      event.on('start', (activityApi, executionContext) => {
        const state = activityApi.getApi(executionContext).getState();
        expect(state).to.include({
          id: 'timeoutEvent',
          type: 'bpmn:IntermediateCatchEvent',
          timeout: 10,
          duration: 10,
          entered: true
        });
        expect(state.startedAt).to.eql(startedAt);

        ck.reset();
        activityApi.stop();
        done();
      });

      event.activate();
      event.inbound[0].take();
    });

    it('resolves duration expression when executed', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <startEvent id="start" />
          <intermediateCatchEvent id="timeoutEventWithVar">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT\${variables.timeout}S</timeDuration>
            </timerEventDefinition>
          </intermediateCatchEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="timeoutEvent" />
          <sequenceFlow id="flow2" sourceRef="timeoutEvent" targetRef="end" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, (err, context2) => {
        if (err) return done(err);

        context2.environment.assignVariables({
          timeout: 0.2
        });

        const event = context2.getChildActivityById('timeoutEventWithVar');

        event.once('start', (activityApi, executionContext) => {
          expect(activityApi.getApi(executionContext).getState().duration).to.equal(200);
          activityApi.stop();
          done();
        });

        event.run();
      });
    });

    it('emits end when timed out', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', () => {
        done();
      });

      event.inbound[0].take();
    });

    it('discards outbound if inbound was discarded', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.outbound[0].once('discarded', () => {
        done();
      });

      event.activate();
      event.inbound.forEach((f) => f.discard());
    });
  });

  describe('TimerEventDefinition', () => {
    it('waits duration', (done) => {
      const engine = new Engine({
        source: factory.resource('timer-event.bpmn')
      });
      const listener = new EventEmitter();

      const calledEnds = [];
      listener.on('end', (e) => {
        calledEnds.push(e.id);
      });

      engine.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);

        expect(calledEnds).to.include.members(['task1', 'duration', 'task2']);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });
  });
});
