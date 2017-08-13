'use strict';

const ck = require('chronokinesis');
const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const getPropertyValue = require('../../lib/getPropertyValue');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {afterEach, beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('BoundaryEvent with TimerEventDefinition', () => {

  describe('behaviour', () => {
    let context;
    beforeEach((done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <startEvent id="start" />
          <userTask id="dontWaitForMe" />
          <boundaryEvent id="timeoutEvent" attachedToRef="dontWaitForMe">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT0.1S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="dontWaitForMe" />
          <sequenceFlow id="flow2" sourceRef="dontWaitForMe" targetRef="end1" />
          <sequenceFlow id="flow3" sourceRef="timeoutEvent" targetRef="end2" />
        </process>
      </definitions>`;

      testHelpers.getContext(source, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
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
        duration: 'PT0.1S',
        cancelActivity: true
      });

      done();
    });

    it('has property cancelActivity true', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      expect(event).to.include({
        cancelActivity: true
      });
      done();
    });

    it('resolves duration when executed', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.on('start', (activityApi, executionContext) => {
        activityApi.stop();
        expect(activityApi.getApi(executionContext).getState().duration).to.equal(100);
        done();
      });
      event.once('end', () => {
        fail('should have been stopped');
      });

      task.run();
    });

    it('returns expected state on start', (done) => {
      ck.freeze();
      const startedAt = new Date();
      const task = context.getChildActivityById('dontWaitForMe');
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.on('start', (activityApi, executionContext) => {
        const eventApi = activityApi.getApi(executionContext);
        expect(eventApi.getState()).to.equal({
          id: 'timeoutEvent',
          type: 'bpmn:BoundaryEvent',
          attachedToId: 'dontWaitForMe',
          startedAt,
          timeout: 100,
          duration: 100,
          entered: true
        });
        eventApi.stop();
        done();
      });

      task.run();
    });

    it('resolves duration expression when executed', (done) => {
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

        context2.environment.assignVariables({
          timeout: 0.2
        });

        const task = context2.getChildActivityById('dontWaitForMe');
        const event = context2.getChildActivityById('timeoutEventWithVar');
        event.activate();

        event.once('start', (activityApi, executionContext) => {
          expect(activityApi.getApi(executionContext).getState().duration).to.equal(200);
          activityApi.stop();
          done();
        });
        event.once('end', () => {
          fail('should have been stopped');
        });

        task.run();
      });
    });

    it('emits end when timed out', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.on('end', () => {
        done();
      });

      task.run();
    });

    it('stops timer if discarded', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', fail.bind(null, 'No end event should have been emitted'));
      event.once('leave', () => {
        done();
      });
      event.once('start', (activityApi, executionContext) => {
        activityApi.getApi(executionContext).discard();
      });

      task.run();
    });

    it('starts when attachedTo inbound is taken', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('start', (activityApi) => {
        activityApi.stop();
        done();
      });

      task.inbound[0].take();
    });

    it('discards outbound when attachedTo completes', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      task.once('wait', (activityApi, executionContext) => {
        activityApi.getApi(executionContext).signal();
      });

      event.outbound[0].once('discarded', () => {
        done();
      });

      task.inbound[0].take();
    });

    it('discards attachedTo if completed', (done) => {
      context.environment.assignVariables({duration: 'PT0.01S'});

      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      task.outbound[0].once('discarded', () => {
        done();
      });

      task.inbound[0].take();
    });

    it('returns expected state when completed', (done) => {
      context.environment.assignVariables({duration: 'PT0.01S'});

      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', (activityApi, executionContext) => {
        const eventApi = activityApi.getApi(executionContext);
        const state = eventApi.getState();
        expect(state.entered).to.be.undefined();
        expect(state.timeout).to.be.below(1);
        done();
      });

      task.inbound[0].take();
    });

    it('is discarded if task is canceled', (done) => {
      const engine = new Engine({
        source: factory.resource('boundary-timeout.bpmn')
      });
      const listener = new EventEmitter();
      listener.once('wait-userTask', (activityApi) => {
        activityApi.cancel();
      });
      listener.once('end-boundTimeoutEvent', (activityApi) => {
        fail(`<${activityApi.id}> should have been discarded`);
      });

      engine.execute({
        listener
      }, (err) => {
        if (err) return done(err);

        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('cancels task', (done) => {
      const engine = new Engine({
        source: factory.resource('boundary-timeout.bpmn')
      });
      const listener = new EventEmitter();
      listener.once('end-userTask', (e) => {
        fail(`<${e.id}> should have been discarded`);
      });

      engine.execute({
        listener: listener
      }, (err) => {
        if (err) return done(err);

        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    describe('non-interupting', () => {
      const source = factory.resource('boundary-non-interupting-timer.bpmn');

      it('does not discard task', (done) => {
        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        const calledEnds = [];
        listener.once('end-userTask', (e) => {
          calledEnds.push(e.id);
        });

        listener.once('end-boundaryEvent', (activity, execution) => {
          calledEnds.push(activity.id);

          execution.signal('userTask');
        });

        engine.execute({
          listener: listener
        }, (err) => {
          if (err) return done(err);

          expect(calledEnds).to.include(['userTask', 'boundaryEvent']);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });
      });

      it('is discarded if task completes', (done) => {
        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();

        listener.once('wait-userTask', (task) => {
          task.signal();
        });

        const calledEnds = [];
        listener.once('end-userTask', (e) => {
          calledEnds.push(e.id);
        });

        listener.once('end-boundaryEvent', (e) => {
          calledEnds.push(e.id);
        });

        engine.execute({
          listener
        }, (err) => {
          if (err) return done(err);
          expect(calledEnds).to.include(['userTask']);
          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });
      });

      it('is discarded if task is canceled', (done) => {
        const engine = new Engine({
          source
        });
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.cancel();
        });
        listener.once('end-boundaryEvent', (e) => {
          fail(`<${e.id}> should have been discarded`);
        });

        engine.execute({
          listener: listener
        }, (err) => {
          if (err) return done(err);

          testHelpers.expectNoLingeringListenersOnEngine(engine);
          done();
        });
      });
    });
  });

  describe('getState()', () => {
    it('returns remaining timeout and attachedTo', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <userTask id="dontWaitForMe" />
          <boundaryEvent id="timeoutEvent" attachedToRef="dontWaitForMe">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT0.1S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
        </process>
      </definitions>`;

      const engine = new Engine({
        source,
        name: 'stopMe'
      });
      const listener = new EventEmitter();

      listener.once('wait-dontWaitForMe', () => {
        setTimeout(() => {
          engine.stop();
        }, 10);
      });

      engine.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });

      engine.once('end', () => {
        const state = engine.getState();

        const eventState = getPropertyValue(state, 'definitions[0].processes.interruptedProcess.children', []).find(({id}) => id === 'timeoutEvent');
        expect(eventState.timeout).to.be.below(100);
        expect(eventState.attachedToId).to.equal('dontWaitForMe');

        testHelpers.expectNoLingeringListenersOnEngine(engine);

        done();
      });
    });
  });

  describe('resume()', () => {
    it('resumes from remaining timeout', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <userTask id="dontWaitForMe" />
          <boundaryEvent id="timeoutEvent" attachedToRef="dontWaitForMe">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT0.05S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
        </process>
      </definitions>`;

      const engine1 = new Engine({
        source,
        name: 'stopMe'
      });
      const listener = new EventEmitter();

      let state;
      listener.once('wait-dontWaitForMe', () => {
        setTimeout(engine1.stop.bind(engine1), 10);
      });

      engine1.once('end', () => {
        let timer = Date.now();
        state = engine1.getState();

        testHelpers.expectNoLingeringListenersOnEngine(engine1);
        const listener2 = new EventEmitter();
        listener2.once('enter-timeoutEvent', (activityApi) => {
          timer = activityApi.getState().timeout;
        });
        Engine.resume(state, {
          listener: listener2
        }, (err) => {
          if (err) return done(err);
          expect(timer, 'timeout').to.be.above(0).and.lessThan(41);
          done();
        });
      });

      engine1.execute({
        listener
      }, (err) => {
        if (err) return done(err);
      });
    });

    it('resumes if not entered yet', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <userTask id="takeMeFirst" />
          <userTask id="dontWaitForMe" />
          <boundaryEvent id="timeoutEvent" attachedToRef="dontWaitForMe">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT0.05S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
          <sequenceFlow id="flow1" sourceRef="takeMeFirst" targetRef="dontWaitForMe" />
        </process>
      </definitions>`;

      const engine1 = new Engine({
        source,
        name: 'stopMe'
      });
      const listener1 = new EventEmitter();

      let state;
      listener1.once('wait-takeMeFirst', () => {
        state = engine1.getState();
        engine1.stop();
      });

      engine1.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine1);
        const listener2 = new EventEmitter();
        listener2.once('wait-takeMeFirst', (task) => {
          task.signal('Continue');
        });
        Engine.resume(state, {
          listener: listener2
        }, done);
      });

      engine1.execute({
        listener: listener1
      }, (err) => {
        if (err) return done(err);
      });
    });
  });

  describe('attachedTo multiple inbound', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="testProcess" isExecutable="true">
        <startEvent id="start" />
        <serviceTask id="task" name="Get" camunda:expression="\${services.get(variables.defaultTaken)}" camunda:resultVariable="taskOutput" />
        <boundaryEvent id="timeoutEvent" attachedToRef="task">
          <timerEventDefinition>
            <timeDuration xsi:type="tFormalExpression">PT0.05S</timeDuration>
          </timerEventDefinition>
        </boundaryEvent>
        <exclusiveGateway id="decision" default="flow4">
          <extensionElements>
            <camunda:inputOutput>
              <camunda:outputParameter name="defaultTaken">\${true}</camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </exclusiveGateway>
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="decision" />
        <sequenceFlow id="flow3" sourceRef="timeoutEvent" targetRef="decision" />
        <sequenceFlow id="flow4" sourceRef="decision" targetRef="task" />
        <sequenceFlow id="flow5" sourceRef="decision" targetRef="end">
          <conditionExpression xsi:type="tFormalExpression">\${variables.defaultTaken}</conditionExpression>
        </sequenceFlow>
      </process>
    </definitions>`;

    it('completes process if no timeout', (done) => {
      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activity) => {
        startCount++;
        if (startCount > 2) {
          fail(`<${activity.id}> Too many starts`);
        }
      });
      let endEventCount = 0;
      listener.on('start-end', () => {
        endEventCount++;
      });

      engine.execute({
        listener,
        services: {
          get: (defaultTaken) => {
            return function(context, callback) {
              callback(null, `successfully executed ${defaultTaken === true ? 'twice' : 'once'}`);
            };
          }
        },
        variables: {
          api: 'http://example.com'
        }
      });
      engine.once('end', (execution) => {
        expect(startCount, 'task starts').to.equal(2);
        expect(endEventCount, 'end event').to.equal(1);
        expect(execution.getOutput()).to.equal({
          defaultTaken: true,
          taskOutput: ['successfully executed twice']
        });
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('completes process if timed out', (done) => {
      const engine = new Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      let startCount = 0;
      listener.on('start-task', (activity) => {
        startCount++;
        if (startCount > 2) {
          fail(`<${activity.id}> Too many starts`);
        }
      });
      let endEventCount = 0;
      listener.on('start-end', () => {
        endEventCount++;
      });

      engine.execute({
        listener,
        services: {
          get: () => {
            return function() {};
          }
        },
        variables: {
          api: 'http://example.com'
        }
      });
      engine.once('end', (def) => {
        expect(startCount, 'task starts').to.equal(2);
        expect(endEventCount, 'end event').to.equal(1);
        expect(def.getOutput()).to.equal({
          defaultTaken: true
        });
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

  });
});
