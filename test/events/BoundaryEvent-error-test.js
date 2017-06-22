'use strict';

const Code = require('code');
const expect = Code.expect;
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const getPropertyValue = require('../../lib/getPropertyValue');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const Bpmn = require('../..');

lab.experiment('Error BoundaryEvent', () => {

  lab.describe('behaviour', () => {
    const processXml = `
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <serviceTask id="service" camunda:expression="\${services.test}" />
        <boundaryEvent id="errorEvent" attachedToRef="service">
          <errorEventDefinition errorRef="Error_0w1hljb" camunda:errorCodeVariable="serviceError" camunda:errorMessageVariable="message" />
        </boundaryEvent>
        <endEvent id="end" />
        <sequenceFlow id="flow0" sourceRef="start" targetRef="service" />
        <sequenceFlow id="flow1" sourceRef="service" targetRef="end" />
        <sequenceFlow id="flow2" sourceRef="errorEvent" targetRef="end" />
      </process>
      <error id="Error_0w1hljb" name="ServiceError" errorCode="\${message}" />
    </definitions>`;

    let context;
    lab.beforeEach((done) => {

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;

        context.variablesAndServices = {
          services: {
            test: (arg, next) => {
              next();
            }
          }
        };

        done();
      });
    });

    lab.test('has property cancelActivity true', (done) => {
      const event = context.getChildActivityById('errorEvent');
      expect(event).to.include({
        cancelActivity: true
      });
      done();
    });

    lab.test('loads event definitions on activate', (done) => {
      const event = context.getChildActivityById('errorEvent');
      const eventApi = event.activate();

      const boundEvents = eventApi.getEvents();
      expect(boundEvents).to.have.length(1);

      expect(boundEvents[0]).to.include({
        id: 'errorEvent',
        type: 'bpmn:ErrorEventDefinition',
        cancelActivity: true
      });

      done();
    });

    lab.test('returns expected state on start', (done) => {
      const event = context.getChildActivityById('errorEvent');

      event.on('start', (activity) => {
        activity.stop();
        expect(activity.getState()).to.equal({
          id: 'errorEvent',
          type: 'bpmn:BoundaryEvent',
          attachedToId: 'service',
          errorId: 'Error_0w1hljb',
          entered: true
        });
        done();
      });

      event.run();
    });

    lab.test('resolves error code expression on caught error', (done) => {
      context.variablesAndServices.services.test = (arg, next) => {
        next(new Error('FAIL'));
      };

      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('errorEvent');
      event.activate();

      event.once('catch', (caughtError, activity) => {
        activity.stop();
        expect(caughtError.name, 'name').to.equal('ServiceError');
        expect(caughtError.message, 'message').to.equal('FAIL');
        expect(caughtError.errorCode, 'error code').to.equal('FAIL');
        done();
      });

      task.run();
    });

    lab.test('outputs errorCodeVariable on caught error', (done) => {
      context.variablesAndServices.services.test = (arg, next) => {
        next(new Error('FAIL'));
      };

      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('errorEvent');
      event.activate();

      event.once('end', (activity) => {
        activity.stop();

        const output = activity.getOutput();

        expect(output.serviceError, 'errorCodeVariable').to.equal('FAIL');
        expect(output.message, 'errorMessageVariable').to.equal('FAIL');
        done();
      });

      task.run();
    });

    lab.test('discards outbound when attachedTo completes', (done) => {
      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('errorEvent');
      task.activate();
      event.activate();

      event.outbound[0].once('discarded', () => {
        done();
      });

      task.run();
    });

    lab.test('discards attachedTo if completed', (done) => {
      context.variablesAndServices.services.test = (arg, next) => {
        next(new Error('FAIL'));
      };

      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('errorEvent');
      task.activate();
      event.activate();

      task.outbound[0].once('discarded', () => {
        done();
      });

      task.inbound[0].take();
    });

    lab.test('returns expected state when completed', (done) => {
      context.variablesAndServices.services.test = (arg, next) => {
        next(new Error('FAIL'));
      };

      const task = context.getChildActivityById('service');
      const event = context.getChildActivityById('errorEvent');
      task.activate();
      event.activate();

      event.once('end', (eventApi) => {
        const state = eventApi.getState();
        expect(state).to.not.include(['entered']);
        expect(state).to.include({
          taken: true
        });
        done();
      });

      task.inbound[0].take();
    });
  });

  lab.describe('engine', () => {
    const processXml = `
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <serviceTask id="service" camunda:expression="\${services.test}" />
        <boundaryEvent id="errorEvent" attachedToRef="service">
          <errorEventDefinition errorRef="Error_0w1hljb" camunda:errorCodeVariable="serviceError" camunda:errorMessageVariable="message" />
        </boundaryEvent>
        <endEvent id="end" />
        <sequenceFlow id="flow0" sourceRef="start" targetRef="service" />
        <sequenceFlow id="flow1" sourceRef="service" targetRef="end" />
        <sequenceFlow id="flow2" sourceRef="errorEvent" targetRef="end" />
      </process>
      <error id="Error_0w1hljb" name="ServiceError" errorCode="\${message}" />
    </definitions>`;

    lab.test('event is discarded if task completes', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener = new EventEmitter();
      listener.once('end-errorEvent', (e) => {
        Code.fail(`<${e.id}> should have been discarded`);
      });

      engine.execute({
        listener: listener,
        services: {
          test: (arg, next) => {
            next();
          }
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    lab.test('task is discarded on error', (done) => {
      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener = new EventEmitter();
      listener.once('end-service', (e) => {
        Code.fail(`<${e.id}> should have been discarded`);
      });

      engine.execute({
        listener: listener,
        services: {
          test: (arg, next) => {
            next(new Error('Boom'));
          }
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });
  });

  //   lab.test('emits end when timed out', (done) => {
  //     const event = context.getChildActivityById('timeoutEvent');
  //     event.activate();

  //     event.once('end', () => {
  //       done();
  //     });

  //     event.run();
  //   });

  //   lab.test('stops timer if discarded', (done) => {
  //     const event = context.getChildActivityById('timeoutEvent');
  //     event.activate();

  //     event.once('end', Code.fail.bind(null, 'No end event should have been emitted'));
  //     event.once('leave', () => {
  //       expect(event.timer).to.not.exist();
  //       done();
  //     });
  //     event.once('start', (activity) => {
  //       activity.discard();
  //     });

  //     event.run();
  //   });

  //   lab.test('starts when attachedTo runs', (done) => {
  //     const task = context.getChildActivityById('dontWaitForMe');
  //     task.activate();

  //     const event = context.getChildActivityById('timeoutEvent');
  //     event.activate();

  //     event.once('start', () => {
  //       done();
  //     });

  //     task.inbound[0].take();
  //   });

  //   lab.test('discards outbound when attachedTo completes', (done) => {
  //     const task = context.getChildActivityById('dontWaitForMe');
  //     task.activate();

  //     const event = context.getChildActivityById('timeoutEvent');
  //     event.activate();

  //     task.once('wait', (activity) => {
  //       activity.signal();
  //     });

  //     event.outbound[0].once('discarded', () => {
  //       done();
  //     });

  //     task.inbound[0].take();
  //   });

  //   lab.test('discards attachedTo if completed', (done) => {
  //     context.variablesAndServices.variables.duration = 'PT0.01S';

  //     const task = context.getChildActivityById('dontWaitForMe');
  //     task.activate();

  //     const event = context.getChildActivityById('timeoutEvent');
  //     event.activate();

  //     task.outbound[0].once('discarded', () => {
  //       done();
  //     });

  //     task.inbound[0].take();
  //   });

  //   lab.test('returns expected state when completed', (done) => {
  //     context.variablesAndServices.variables.duration = 'PT0.01S';

  //     const task = context.getChildActivityById('dontWaitForMe');
  //     task.activate();

  //     const event = context.getChildActivityById('timeoutEvent');
  //     event.activate();

  //     event.once('end', (eventApi) => {
  //       const state = eventApi.getState();
  //       expect(state).to.not.include(['entered']);
  //       expect(state.timeout).to.be.below(1);
  //       done();
  //     });

  //     task.inbound[0].take();
  //   });

  //   lab.describe('interupting', () => {
  //     const processXml = factory.resource('boundary-timeout.bpmn');

  //     lab.test('is discarded if task completes', (done) => {
  //       const engine = new Bpmn.Engine({
  //         source: processXml
  //       });
  //       const listener = new EventEmitter();
  //       listener.once('wait-userTask', (task) => {
  //         task.signal();
  //       });
  //       listener.once('end-boundTimeoutEvent', (e) => {
  //         Code.fail(`<${e.id}> should have been discarded`);
  //       });

  //       engine.execute({
  //         listener: listener
  //       }, (err, definition) => {
  //         if (err) return done(err);

  //         definition.once('end', () => {
  //           testHelpers.expectNoLingeringListenersOnDefinition(definition);
  //           done();
  //         });
  //       });
  //     });

  //     lab.test('is discarded if task is canceled', (done) => {
  //       const engine = new Bpmn.Engine({
  //         source: processXml
  //       });
  //       const listener = new EventEmitter();
  //       listener.once('wait-userTask', (task) => {
  //         task.cancel();
  //       });
  //       listener.once('end-boundTimeoutEvent', (e) => {
  //         Code.fail(`<${e.id}> should have been discarded`);
  //       });

  //       engine.execute({
  //         listener: listener
  //       }, (err, definition) => {
  //         if (err) return done(err);

  //         definition.once('end', () => {
  //           testHelpers.expectNoLingeringListenersOnDefinition(definition);
  //           done();
  //         });
  //       });
  //     });

  //     lab.test('cancels task', (done) => {
  //       const engine = new Bpmn.Engine({
  //         source: processXml
  //       });
  //       const listener = new EventEmitter();
  //       listener.once('end-userTask', (e) => {
  //         Code.fail(`<${e.id}> should have been discarded`);
  //       });

  //       engine.execute({
  //         listener: listener
  //       }, (err, definition) => {
  //         if (err) return done(err);

  //         definition.once('end', () => {
  //           testHelpers.expectNoLingeringListenersOnDefinition(definition);
  //           done();
  //         });
  //       });
  //     });
  //   });

  //   lab.describe('non-interupting', () => {
  //     const processXml = factory.resource('boundary-non-interupting-timer.bpmn');

  //     lab.test('does not discard task', (done) => {
  //       const engine = new Bpmn.Engine({
  //         source: processXml
  //       });
  //       const listener = new EventEmitter();

  //       const calledEnds = [];
  //       listener.once('end-userTask', (e) => {
  //         calledEnds.push(e.id);
  //       });

  //       listener.once('end-boundaryEvent', (activity, execution) => {
  //         calledEnds.push(activity.id);

  //         execution.signal('userTask');
  //       });

  //       engine.execute({
  //         listener: listener
  //       }, (err, definition) => {
  //         if (err) return done(err);

  //         definition.once('end', () => {
  //           expect(calledEnds).to.include(['userTask', 'boundaryEvent']);
  //           testHelpers.expectNoLingeringListenersOnDefinition(definition);
  //           done();
  //         });
  //       });
  //     });

  //     lab.test('is discarded if task completes', (done) => {
  //       const engine = new Bpmn.Engine({
  //         source: processXml
  //       });
  //       const listener = new EventEmitter();

  //       listener.once('wait-userTask', (task) => {
  //         task.signal();
  //       });

  //       const calledEnds = [];
  //       listener.once('end-userTask', (e) => {
  //         calledEnds.push(e.id);
  //       });

  //       listener.once('end-boundaryEvent', (e) => {
  //         calledEnds.push(e.id);
  //       });

  //       engine.execute({
  //         listener: listener
  //       }, (err, definition) => {
  //         if (err) return done(err);
  //         definition.once('end', () => {
  //           expect(calledEnds).to.include(['userTask']);
  //           testHelpers.expectNoLingeringListenersOnDefinition(definition);
  //           done();
  //         });
  //       });
  //     });

  //     lab.test('is discarded if task is canceled', (done) => {
  //       const engine = new Bpmn.Engine({
  //         source: processXml
  //       });
  //       const listener = new EventEmitter();
  //       listener.once('wait-userTask', (task) => {
  //         task.cancel();
  //       });
  //       listener.once('end-boundaryEvent', (e) => {
  //         Code.fail(`<${e.id}> should have been discarded`);
  //       });

  //       engine.execute({
  //         listener: listener
  //       }, (err, definition) => {
  //         if (err) return done(err);

  //         definition.once('end', () => {
  //           testHelpers.expectNoLingeringListenersOnDefinition(definition);
  //           done();
  //         });
  //       });
  //     });
  //   });
  // });

  lab.describe('getState()', () => {
    lab.test('returns remaining entered and attachedTo', (done) => {
      const processXml = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="interruptedProcess" isExecutable="true">
          <serviceTask id="service" camunda:expression="\${services.test}" />
          <boundaryEvent id="errorEvent" attachedToRef="service">
            <errorEventDefinition errorRef="Error_0w1hljb" camunda:errorCodeVariable="serviceError" camunda:errorMessageVariable="message" />
          </boundaryEvent>
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="service" targetRef="end1" />
          <sequenceFlow id="flow2" sourceRef="errorEvent" targetRef="end2" />
        </process>
        <error id="Error_0w1hljb" name="ServiceError" errorCode="\${message}" />
      </definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        name: 'stopMe',
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener = new EventEmitter();

      listener.once('start-service', () => {
        engine.stop();
      });

      testHelpers.testBoundError = (context, next) => {
        return next(new Error('FAILED'));
      };

      engine.execute({
        listener,
        services: {
          test: {
            module: './test/helpers/testHelpers',
            fnName: 'testBoundError'
          }
        }
      }, (err) => {
        if (err) return done(err);
      });

      engine.once('end', () => {
        const state = engine.getState();

        const serviceState = getPropertyValue(state, 'definitions[0].processes.interruptedProcess.children', []).find(({id}) => id === 'service');
        const eventState = getPropertyValue(state, 'definitions[0].processes.interruptedProcess.children', []).find(({id}) => id === 'errorEvent');

        expect(eventState.entered, 'entered bound error event').to.be.true();
        expect(eventState.attachedToId).to.equal('service');

        expect(serviceState.entered, 'entered service').to.be.true();

        testHelpers.expectNoLingeringListenersOnEngine(engine);

        done();
      });
    });
  });

  lab.describe('resume()', () => {
    lab.test('resumes if not entered yet', (done) => {
      const processXml = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="interruptedProcess" isExecutable="true">
          <serviceTask id="service" camunda:expression="\${services.test}" />
          <boundaryEvent id="errorEvent" attachedToRef="service">
            <errorEventDefinition errorRef="Error_0w1hljb" camunda:errorCodeVariable="serviceError" camunda:errorMessageVariable="message" />
          </boundaryEvent>
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="service" targetRef="end1" />
          <sequenceFlow id="flow2" sourceRef="errorEvent" targetRef="end2" />
        </process>
        <error id="Error_0w1hljb" name="ServiceError" errorCode="\${message}" />
      </definitions>`;

      const engine1 = new Bpmn.Engine({
        source: processXml,
        name: 'stopMe',
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });
      const listener1 = new EventEmitter();

      let state;
      listener1.once('start-service', () => {
        state = engine1.getState();
        engine1.stop();
      });

      engine1.once('end', () => {
        testHelpers.expectNoLingeringListenersOnEngine(engine1);

        Bpmn.Engine.resume(state, {}, (err, resumedInstance) => {
          if (err) return done(err);
          resumedInstance.once('end', () => {
            done();
          });
        });
      });

      testHelpers.testBoundError = (context, next) => {
        return next(new Error('RESUMEERR'));
      };

      engine1.execute({
        listener: listener1,
        services: {
          test: {
            module: './test/helpers/testHelpers',
            fnName: 'testBoundError'
          }
        }
      }, (err) => {
        if (err) return done(err);
      });
    });
  });
});
