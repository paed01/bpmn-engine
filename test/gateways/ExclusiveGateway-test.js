'use strict';

const {Engine} = require('../../lib');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('ExclusiveGateway', () => {
  describe('behavior', () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="mainProcess" isExecutable="true">
        <startEvent id="start" />
        <exclusiveGateway id="decision" default="defaultFlow">
          <extensionElements>
            <camunda:InputOutput>
              <camunda:inputParameter name="takeCondition1">\${variables.condition1}</camunda:inputParameter>
              <camunda:inputParameter name="takeCondition2">\${variables.condition2}</camunda:inputParameter>
              <camunda:outputParameter name="enteredDecision">Yes</camunda:outputParameter>
            </camunda:InputOutput>
          </extensionElements>
        </exclusiveGateway>
        <endEvent id="end1" />
        <endEvent id="end2" />
        <endEvent id="end3" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
        <sequenceFlow id="defaultFlow" sourceRef="decision" targetRef="end2" />
        <sequenceFlow id="condFlow1" sourceRef="decision" targetRef="end1">
          <conditionExpression xsi:type="tFormalExpression">\${takeCondition1}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="condFlow2" sourceRef="decision" targetRef="end3">
          <conditionExpression xsi:type="tFormalExpression">\${takeCondition2}</conditionExpression>
        </sequenceFlow>
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(source, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    it('variables and services are passed to conditional flow', (done) => {
      context.environment.assignVariables({condition1: true});

      const gateway = context.getChildActivityById('decision');
      const activityApi = gateway.activate();

      gateway.outbound.find((f) => f.id === 'condFlow1').once('taken', () => {
        activityApi.stop();
        done();
      });

      gateway.run();
    });

    it('end returns output in callback', (done) => {
      context.environment.assignVariables({condition1: false});

      const gateway = context.getChildActivityById('decision');
      gateway.activate();

      gateway.once('end', (activityApi, activityExecution) => {
        const output = activityExecution.getOutput();

        expect(output).to.equal({
          enteredDecision: 'Yes'
        });

        expect(gateway.outbound[0].taken, gateway.outbound[0].id).to.be.true();
        expect(gateway.outbound[1].taken, gateway.outbound[1].id).to.be.undefined();
        expect(gateway.outbound[2].taken, gateway.outbound[2].id).to.be.undefined();
        done();
      });

      gateway.run();
    });

    it('discards rest outbound if one outbound was taken', (done) => {
      context.environment.assignVariables({condition2: true});

      const gateway = context.getChildActivityById('decision');
      gateway.activate();

      const discardedFlows = [];
      gateway.outbound.forEach((f) => {
        f.once('discarded', () => {
          discardedFlows.push(f.id);
        });
      });

      gateway.once('leave', () => {
        expect(discardedFlows, 'discarded flows').to.equal(['condFlow1', 'defaultFlow']);
        done();
      });

      gateway.inbound[0].take();
    });

    it('discards all outbound if inbound was discarded', (done) => {
      const gateway = context.getChildActivityById('decision');
      gateway.activate();

      const discardedFlows = [];
      gateway.outbound.forEach((f) => {
        f.once('discarded', () => {
          discardedFlows.push(f.id);

          if (gateway.outbound.length === discardedFlows.length) {
            expect(discardedFlows, 'discarded flows').to.equal(['defaultFlow', 'condFlow1', 'condFlow2']);
            done();
          }
        });
      });

      gateway.inbound[0].discard();
    });

    describe('resume()', () => {
      it('sets resumed gateway pendingOutbound', (done) => {
        const gateway = context.getChildActivityById('decision');

        const activityApi = gateway.activate();

        gateway.once('start', () => {
          gateway.outbound[1].once('discarded', () => {
            activityApi.stop();

            const state = activityApi.getState();

            expect(state).to.include({
              discardedOutbound: ['condFlow1'],
              pendingOutbound: ['condFlow2', 'defaultFlow']
            });

            const clonedContext = testHelpers.cloneContext(context);
            const resumedGateway = clonedContext.getChildActivityById('decision');
            resumedGateway.id += '-resumed';

            resumedGateway.once('enter', (resumedApi, activityExecution) => {
              const api = resumedApi.getApi(activityExecution);
              api.stop();
              expect(api.getState().pendingOutbound).to.equal(['condFlow2', 'defaultFlow']);
              done();
            });

            resumedGateway.activate(state).resume();
          });
        });

        gateway.inbound[0].take();
      });

      it('discards rest if one flow was taken', (done) => {
        context.environment.assignVariables({
          condition1: true,
          condition2: true
        });

        const gateway = context.getChildActivityById('decision');

        const flowSequence = [];
        gateway.outbound.forEach((f) => {
          f.on('taken', (flow) => {
            flowSequence.push(`taken-${flow.id}`);
          });
          f.on('discarded', (flow) => {
            flowSequence.push(`discarded-${flow.id}`);
          });
        });

        gateway.once('start', (activity) => {
          gateway.outbound[1].once('taken', () => {
            activity.stop();

            const state = activity.getState();

            expect(state).to.include({
              pendingOutbound: ['condFlow2', 'defaultFlow']
            });

            const clonedContext = testHelpers.cloneContext(context);
            const resumedGateway = clonedContext.getChildActivityById('decision');
            resumedGateway.id += '-resumed';

            resumedGateway.once('leave', (g) => {
              const defaultFlow = g.outbound.find((f) => f.isDefault);
              expect(defaultFlow.taken, defaultFlow.id).to.be.true();

              expect(flowSequence).to.equal(['taken-condFlow1', 'discarded-condFlow2', 'discarded-defaultFlow']);

              done();
            });

            resumedGateway.activate(state).resume();
          });
        });

        gateway.activate();
        gateway.inbound[0].take();
      });

      it('takes defaultFlow if no other flows were taken', (done) => {
        const gateway = context.getChildActivityById('decision');

        gateway.once('start', (activity) => {
          gateway.outbound[1].once('discarded', () => {
            activity.stop();

            const state = activity.getState();

            expect(state).to.include({
              discardedOutbound: ['condFlow1'],
              pendingOutbound: ['condFlow2', 'defaultFlow']
            });

            const clonedContext = testHelpers.cloneContext(context);
            const resumedGateway = clonedContext.getChildActivityById('decision');
            resumedGateway.id += '-resumed';

            resumedGateway.once('end', (g) => {
              const defaultFlow = g.outbound.find((f) => f.isDefault);
              expect(defaultFlow.taken, defaultFlow.id).to.be.true();
              done();
            });

            resumedGateway.activate(state).resume();
          });
        });

        gateway.activate();
        gateway.inbound[0].take();
      });

      it('emits error when no conditional flow is taken', (done) => {
        const definition = `
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <process id="theProcess" isExecutable="true">
            <startEvent id="theStart" />
            <exclusiveGateway id="decision" />
            <endEvent id="end1" />
            <endEvent id="end2" />
            <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
            <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
              <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
              this.variables.input <= 60
              ]]></conditionExpression>
            </sequenceFlow>
            <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
              <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
              this.variables.input <= 50
              ]]></conditionExpression>
            </sequenceFlow>
          </process>
        </definitions>`;

        testHelpers.getContext(definition, {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }, (getErr, testContext) => {
          if (getErr) return done(getErr);

          const gateway = testContext.getChildActivityById('decision');

          gateway.once('start', (activity) => {
            gateway.outbound[0].once('discarded', () => {
              activity.stop();

              const state = activity.getState();

              expect(state).to.include({
                discardedOutbound: ['flow2'],
                pendingOutbound: ['flow3']
              });

              const clonedContext = testHelpers.cloneContext(testContext);
              const resumedGateway = clonedContext.getChildActivityById('decision');
              resumedGateway.id += '-resumed';

              resumedGateway.once('error', (err) => {
                expect(err).to.be.an.error(/no conditional flow/i);
                done();
              });

              resumedGateway.activate(state).resume();
            });
          });

          gateway.activate();
          gateway.inbound[0].take();
        });
      });

    });
  });

  describe('engine', () => {
    it('should support one diverging flow without a condition', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute((err) => {
        if (err) return done(err);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('should support two diverging flows with conditions, case 10', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input > 50
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        variables: {
          input: 10
        }
      }, (err, execution) => {
        if (err) return done(err);

        expect(execution.getChildState('end1').taken).to.be.true();
        expect(execution.getChildState('end2').taken, 'end2').to.be.undefined();
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('should support two diverging flows with conditions, case 100', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input > 50
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        variables: {
          input: 100
        }
      }, (err, execution) => {
        if (err) return done(err);

        expect(execution.getChildState('end1').taken, 'end1').to.be.undefined();
        expect(execution.getChildState('end2').taken, 'end2').to.be.true();
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('should support diverging flows with default, case 1', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" default="flow2" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        variables: {
          input: 100
        }
      }, (err, execution) => {
        if (err) return done(err);

        expect(execution.getChildState('end1').taken, 'end1').to.be.true();
        expect(execution.getChildState('end2').taken, 'end2').to.be.undefined();
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('should support diverging flows with default, case 2', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" default="flow2" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.execute({
        variables: {
          input: 50
        }
      }, (err, execution) => {
        if (err) return done(err);

        expect(execution.getChildState('end1').taken, 'end1').to.be.undefined();
        expect(execution.getChildState('end2').taken, 'end2').to.be.true();
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });
    });

    it('emits error when no conditional flow is taken', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 60
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.once('error', (err) => {
        expect(err).to.be.an.error(/no conditional flow/i);
        expect(err.source).to.include({
          id: 'decision'
        });
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.execute({
        variables: {
          input: 61
        }
      });
    });

    it('emits error when no conditional flow is taken on resumed gateway', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 60
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      engine.once('error', (err) => {
        expect(err).to.be.an.error(/no conditional flow/i);
        expect(err.source).to.include({
          id: 'decision'
        });
        testHelpers.expectNoLingeringListenersOnEngine(engine);
        done();
      });

      engine.execute({
        variables: {
          input: 61
        }
      });
    });
  });
});
