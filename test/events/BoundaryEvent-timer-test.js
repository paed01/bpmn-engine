'use strict';

const Code = require('code');
const expect = Code.expect;
const factory = require('../helpers/factory');
const getPropertyValue = require('../../lib/getPropertyValue');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');
const EventEmitter = require('events').EventEmitter;

lab.experiment('BoundaryEvent with TimerEventDefinition', () => {

  lab.describe('behaviour', () => {
    let context;
    lab.beforeEach((done) => {
      const processXml = `
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
        duration: 'PT0.1S',
        cancelActivity: true
      });

      done();
    });

    lab.test('resolves timeout when executed', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.on('start', (activity) => {
        activity.stop();
        expect(activity.getState().timeout).to.equal(100);
        done();
      });

      event.run();
    });

    lab.test('returns expected state on start', (done) => {
      const event = context.getChildActivityById('timeoutEvent');

      event.on('start', (activity) => {
        activity.stop();
        expect(activity.getState().timeout).to.equal(100);
        expect(activity.getState()).to.equal({
          id: 'timeoutEvent',
          type: 'bpmn:BoundaryEvent',
          attachedToId: 'dontWaitForMe',
          timeout: 100,
          duration: 100,
          entered: true
        });
        done();
      });

      event.run();
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
  });

  lab.describe('as BoundaryEvent', () => {
    let context;
    lab.beforeEach((done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="timeout" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="interruptedProcess" isExecutable="true">
          <startEvent id="start" />
          <userTask id="dontWaitForMe" />
          <boundaryEvent id="timeoutEvent" attachedToRef="dontWaitForMe">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">\${variables.duration}</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="dontWaitForMe" />
          <sequenceFlow id="flow2" sourceRef="dontWaitForMe" targetRef="end1" />
          <sequenceFlow id="flow3" sourceRef="timeoutEvent" targetRef="end2" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        c.variablesAndServices.variables.duration = 'PT0.1S';
        if (err) return done(err);
        context = c;
        done();
      });
    });

    lab.test('has property cancelActivity true', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      expect(event).to.include({
        cancelActivity: true
      });
      done();
    });

    lab.test('emits end when timed out', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', () => {
        done();
      });

      event.run();
    });

    lab.test('stops timer if discarded', (done) => {
      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', Code.fail.bind(null, 'No end event should have been emitted'));
      event.once('leave', () => {
        expect(event.timer).to.not.exist();
        done();
      });
      event.once('start', (activity) => {
        activity.discard();
      });

      event.run();
    });

    lab.test('starts when attachedTo runs', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('start', () => {
        done();
      });

      task.inbound[0].take();
    });

    lab.test('discards outbound when attachedTo completes', (done) => {
      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      task.once('wait', (activity) => {
        activity.signal();
      });

      event.outbound[0].once('discarded', () => {
        done();
      });

      task.inbound[0].take();
    });

    lab.test('discards attachedTo if completed', (done) => {
      context.variablesAndServices.variables.duration = 'PT0.01S';

      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      task.outbound[0].once('discarded', () => {
        done();
      });

      task.inbound[0].take();
    });

    lab.test('returns expected state when completed', (done) => {
      context.variablesAndServices.variables.duration = 'PT0.01S';

      const task = context.getChildActivityById('dontWaitForMe');
      task.activate();

      const event = context.getChildActivityById('timeoutEvent');
      event.activate();

      event.once('end', (eventApi) => {
        const state = eventApi.getState();
        expect(state).to.not.include(['entered']);
        expect(state.timeout).to.be.below(1);
        done();
      });

      task.inbound[0].take();
    });

    lab.describe('interupting', () => {
      const processXml = factory.resource('boundary-timeout.bpmn');

      lab.test('is discarded if task completes', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.signal();
        });
        listener.once('end-boundTimeoutEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.execute({
          listener: listener
        }, (err, definition) => {
          if (err) return done(err);

          definition.once('end', () => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            done();
          });
        });
      });

      lab.test('is discarded if task is canceled', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.cancel();
        });
        listener.once('end-boundTimeoutEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.execute({
          listener: listener
        }, (err, definition) => {
          if (err) return done(err);

          definition.once('end', () => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            done();
          });
        });
      });

      lab.test('cancels task', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();
        listener.once('end-userTask', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.execute({
          listener: listener
        }, (err, definition) => {
          if (err) return done(err);

          definition.once('end', () => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            done();
          });
        });
      });
    });

    lab.describe('non-interupting', () => {
      const processXml = factory.resource('boundary-non-interupting-timer.bpmn');

      lab.test('does not discard task', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
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
        }, (err, definition) => {
          if (err) return done(err);

          definition.once('end', () => {
            expect(calledEnds).to.include(['userTask', 'boundaryEvent']);
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            done();
          });
        });
      });

      lab.test('is discarded if task completes', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
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
          listener: listener
        }, (err, definition) => {
          if (err) return done(err);
          definition.once('end', () => {
            expect(calledEnds).to.include(['userTask']);
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            done();
          });
        });
      });

      lab.test('is discarded if task is canceled', (done) => {
        const engine = new Bpmn.Engine({
          source: processXml
        });
        const listener = new EventEmitter();
        listener.once('wait-userTask', (task) => {
          task.cancel();
        });
        listener.once('end-boundaryEvent', (e) => {
          Code.fail(`<${e.id}> should have been discarded`);
        });

        engine.execute({
          listener: listener
        }, (err, definition) => {
          if (err) return done(err);

          definition.once('end', () => {
            testHelpers.expectNoLingeringListenersOnDefinition(definition);
            done();
          });
        });
      });
    });
  });

  lab.describe('getState()', () => {
    lab.test('returns remaining timeout and attachedTo', (done) => {
      const processXml = `
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
  </definitions>
      `;
      const engine = new Bpmn.Engine({
        source: processXml,
        name: 'stopMe'
      });
      const listener1 = new EventEmitter();

      listener1.once('wait-dontWaitForMe', () => {
        setTimeout(() => {
          engine.stop();
        }, 10);
      });

      engine.execute({
        listener: listener1
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

  lab.describe('resume()', () => {
    lab.test('resumes if not entered yet', (done) => {
      const processXml = `
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
  </definitions>
      `;
      const engine1 = new Bpmn.Engine({
        source: processXml,
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
        Bpmn.Engine.resume(state, {
          listener: listener2
        }, (err, resumedInstance) => {
          if (err) return done(err);
          resumedInstance.once('end', () => {
            done();
          });
        });
      });

      engine1.execute({
        listener: listener1
      }, (err) => {
        if (err) return done(err);
      });
    });
  });
});
