'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('ParallelGateway', () => {
  describe('join', () => {
    const processXml = `
    <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <parallelGateway id="fork" />
        <parallelGateway id="join" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
        <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
        <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
        <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(processXml, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    it('should have pending inbound on start', (done) => {
      const gateway = context.getChildActivityById('join');
      gateway.activate();

      gateway.once('start', (activityApi) => {
        const state = activityApi.getState();
        expect(state.pendingJoin).to.be.true();
        expect(state.pendingInbound).to.have.length(1);
        done();
      });

      gateway.inbound[0].take();
    });

    it('emits end when all inbounds are taken', (done) => {
      const gateway = context.getChildActivityById('join');
      gateway.activate();

      gateway.on('end', (activityApi) => {
        const state = activityApi.getState();
        expect(state.taken).to.be.true();
        expect(state.pendingInbound).to.be.undefined();
        done();
      });

      gateway.inbound.forEach((f) => f.take());
    });

    it('emits leave when all inbounds are taken', (done) => {
      const gateway = context.getChildActivityById('join');
      gateway.activate();

      gateway.on('leave', (activityApi) => {
        const state = activityApi.getState();
        expect(state.entered).to.be.undefined();
        expect(state.pendingInbound).to.be.undefined();
        done();
      });

      gateway.inbound.forEach((f) => f.take());
    });

    it('discards outbound if inbound was discarded', (done) => {
      const gateway = context.getChildActivityById('join');

      gateway.outbound[0].once('discarded', () => {
        done();
      });

      gateway.activate();
      gateway.inbound.forEach((f) => f.discard());
    });

    describe('getState()', () => {
      it('on start returns pendingInbound', (done) => {
        const gateway = context.getChildActivityById('join');
        gateway.activate();

        gateway.once('start', (activityApi) => {
          const state = activityApi.getState();
          expect(state).to.include({
            pendingInbound: ['flow3']
          });
          done();
        });

        gateway.inbound[0].take();
      });

      it('discarded inbound is returned in discardedInbound', (done) => {
        const gateway = context.getChildActivityById('join');
        gateway.activate();

        gateway.once('start', (activityApi) => {
          const state = activityApi.getState();

          expect(state).to.include({
            pendingInbound: [],
            discardedInbound: ['flow2']
          });
          done();
        });

        gateway.inbound[0].discard();
        gateway.inbound[1].take();
      });
    });

    describe('resume()', () => {

      it('sets resumed gateway pendingInbound', (done) => {
        const gateway = context.getChildActivityById('join');

        gateway.on('start', (activity) => {
          activity.stop();

          const state = activity.getState();
          expect(state).to.include({
            pendingInbound: ['flow3']
          });

          const clonedContext = testHelpers.cloneContext(context);
          const resumedGateway = clonedContext.getChildActivityById('join');
          resumedGateway.id += '-resumed';

          resumedGateway.once('enter', (resumedActivity) => {
            expect(resumedActivity.getState().pendingInbound).to.equal(['flow3']);
            done();
          });

          const resumedGatewayApi = resumedGateway.activate(state);
          resumedGatewayApi.resume();
        });

        gateway.activate();
        gateway.inbound[0].take();
      });

      it('completes when pending inbound flows are taken', (done) => {
        const gateway = context.getChildActivityById('join');

        gateway.on('start', (activityApi) => {
          activityApi.stop();

          const state = activityApi.getState();

          expect(state).to.include({
            pendingInbound: ['flow3']
          });

          const clonedContext = testHelpers.cloneContext(context);
          const resumedGateway = clonedContext.getChildActivityById('join');

          resumedGateway.id += '-resumed';

          resumedGateway.once('enter', () => {
            resumedGateway.inbound[1].take();
          });

          resumedGateway.once('end', () => {
            done();
          });

          const resumedGatewayApi = resumedGateway.activate(state);
          resumedGatewayApi.resume();
        });

        gateway.activate();
        gateway.inbound[0].take();
      });

      it('completes even if one inbound flow was discarded', (done) => {
        const gateway = context.getChildActivityById('join');

        gateway.on('enter', (activityApi) => {
          activityApi.stop();

          const state = activityApi.getState();

          expect(state).to.include({
            pendingInbound: ['flow3'],
            discardedInbound: ['flow2']
          });

          const clonedContext = testHelpers.cloneContext(context);
          const resumedGateway = clonedContext.getChildActivityById('join');

          resumedGateway.id += '-resumed';

          resumedGateway.once('enter', () => {
            resumedGateway.inbound[1].take();
          });

          resumedGateway.once('end', () => {
            done();
          });

          const resumedGatewayApi = resumedGateway.activate(state);
          resumedGatewayApi.resume();
        });

        gateway.activate();
        gateway.inbound[0].discard();
      });

      it('discards outbound if all inbound was discarded', (done) => {
        const gateway = context.getChildActivityById('join');

        gateway.on('enter', (activityApi) => {
          activityApi.stop();

          const state = activityApi.getState();

          expect(state).to.include({
            pendingInbound: ['flow3']
          });

          const clonedContext = testHelpers.cloneContext(context);
          const resumedGateway = clonedContext.getChildActivityById('join');

          resumedGateway.id += '-resumed';

          resumedGateway.outbound[0].once('discarded', () => {
            done();
          });
          resumedGateway.outbound[0].once('taken', () => {
            fail('Should not be taken');
          });
          resumedGateway.once('start', () => {
            fail('Should not emit start');
          });

          const resumedGatewayApi = resumedGateway.activate(state);
          resumedGatewayApi.resume();
          resumedGateway.inbound[1].discard();
        });

        gateway.activate();
        gateway.inbound[0].discard();
      });
    });
  });

  describe('fork', () => {
    const processXml = `
    <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="theStart" />
        <parallelGateway id="fork" />
        <parallelGateway id="join" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
        <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
        <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
        <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
      </process>
    </definitions>`;

    let context;
    beforeEach((done) => {
      testHelpers.getContext(processXml, (err, c) => {
        if (err) return done(err);
        context = c;
        done();
      });
    });

    it('emits start before first outbound is taken', (done) => {
      const gateway = context.getChildActivityById('fork');

      gateway.once('start', (activityApi) => {
        expect(activityApi.getState().pendingOutbound).to.have.length(2);
        done();
      });

      gateway.activate();
      gateway.inbound[0].take();
    });

    it('emits end when all outbounds are taken', (done) => {
      const gateway = context.getChildActivityById('fork');

      gateway.on('end', (activity) => {
        expect(activity.getState().pendingOutbound).to.not.exist();
        done();
      });

      gateway.activate();
      gateway.inbound[0].take();
    });

    it('leaves and discards all outbound if inbound was discarded', (done) => {
      const gateway = context.getChildActivityById('fork');

      const discardedFlows = [];
      gateway.outbound.forEach((f) => {
        f.once('discarded', () => {
          discardedFlows.push(f.id);

          if (gateway.outbound.length === discardedFlows.length) {
            done();
          }
        });
      });

      gateway.on('leave', () => {
        expect(discardedFlows, 'discarded flows').to.equal([]);
      });

      gateway.activate();
      gateway.inbound.forEach((f) => f.discard());
    });

    it('start with fork emits start', (done) => {
      const startProcessXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <parallelGateway id="fork" />
          <parallelGateway id="join" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow3" sourceRef="join" targetRef="end" />
        </process>
      </definitions>`;

      testHelpers.getContext(startProcessXml, (err, ctx) => {
        if (err) return done(err);
        const gateway = ctx.getChildActivityById('fork');

        gateway.once('start', () => {
          done();
        });

        gateway.run();
      });
    });

    describe('resume()', () => {
      it('starts taking pending outbound flows', (done) => {
        const gateway = context.getChildActivityById('fork');

        gateway.on('start', (activityApi) => {
          gateway.outbound[0].once('taken', () => {
            activityApi.stop();

            const state = activityApi.getState();

            expect(state).to.include({
              pendingOutbound: ['flow3']
            });

            const clonedContext = testHelpers.cloneContext(context);
            const resumedGateway = clonedContext.getChildActivityById('fork');

            const takenFlows = [];
            resumedGateway.outbound.forEach((flow) => {
              flow.once('taken', (f) => takenFlows.push(f.id));
            });

            resumedGateway.id += '-resumed';

            resumedGateway.once('end', () => {
              expect(takenFlows).to.equal(['flow3']);
              done();
            });

            const resumedGatewayApi = resumedGateway.activate(state);
            resumedGatewayApi.resume();
          });
        });

        gateway.activate();
        gateway.inbound[0].take();
      });
    });
  });

  describe('engine', () => {
    it('should join diverging fork', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theJoinDivergingForkProcess" isExecutable="true">
          <startEvent id="theStart" />
          <parallelGateway id="fork" />
          <parallelGateway id="join" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
          <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow4" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow5" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });
      engine.execute((err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildState('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    it('should fork multiple diverging flows', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <parallelGateway id="fork" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
          <sequenceFlow id="flow2" sourceRef="fork" targetRef="end1" />
          <sequenceFlow id="flow3" sourceRef="fork" targetRef="end2" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });
      engine.execute((err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildState('end1').taken, 'end1').to.be.true();
          expect(definition.getChildState('end2').taken, 'end2').to.be.true();

          testHelpers.expectNoLingeringListenersOnDefinition(definition);

          done();
        });
      });
    });

    it('should join even if discarded flow', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <inclusiveGateway id="decision" default="flow4" />
          <parallelGateway id="join" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="join" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="join" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="join" />
          <sequenceFlow id="flow5" sourceRef="decision" targetRef="join">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });
      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.once('end', () => {
          expect(definition.getChildState('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    it('should join discarded flow with tasks', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <inclusiveGateway id="decisions" />
          <scriptTask id="script" scriptFormat="Javascript">
            <script>next();</script>
          </scriptTask>
          <userTask id="task" />
          <parallelGateway id="join" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decisions" />
          <sequenceFlow id="flow2" sourceRef="decisions" targetRef="script" />
          <sequenceFlow id="flow3" sourceRef="script" targetRef="join" />
          <sequenceFlow id="flow4" sourceRef="decisions" targetRef="task">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
              this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow5" sourceRef="task" targetRef="join" />
          <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });
      engine.once('end', (def) => {
        expect(def.getChildState('end').taken, 'end').to.be.true();
        expect(def.getChildState('task').taken, 'task').to.not.be.true();
        testHelpers.expectNoLingeringListenersOnDefinition(def);
        done();
      });
      engine.execute({
        variables: {
          input: 51
        }
      });
    });

    it('regardless of flow order', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <inclusiveGateway id="decision" />
          <userTask id="task" />
          <scriptTask id="script" scriptFormat="Javascript">
            <script>next();</script>
          </scriptTask>
          <parallelGateway id="join" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="task">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
              this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow3" sourceRef="task" targetRef="join" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="script" />
          <sequenceFlow id="flow5" sourceRef="script" targetRef="join" />
          <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });
      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildState('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    it('and with default', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <inclusiveGateway id="decision" default="flow4" />
          <userTask id="task" />
          <scriptTask id="script" scriptFormat="Javascript">
            <script>next();</script>
          </scriptTask>
          <parallelGateway id="join" />
          <endEvent id="end" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="script">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
              this.variables.input <= 50
            ]]></conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="flow3" sourceRef="script" targetRef="join" />
          <sequenceFlow id="flow4" sourceRef="decision" targetRef="task" />
          <sequenceFlow id="flow5" sourceRef="task" targetRef="join" />
          <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });
      engine.execute({
        variables: {
          input: 50
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildState('end').taken, 'end').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    it('completes process with multiple joins in discarded path', (done) => {
      const definitionXml = factory.resource('multiple-joins.bpmn');
      const engine = new Engine({
        source: definitionXml
      });

      engine.execute({
        variables: {
          input: 51
        }
      }, (err, definition) => {
        if (err) return done(err);

        definition.on('end', () => {
          expect(definition.getChildState('scriptTask1').taken, 'scriptTask1').to.be.true();
          expect(definition.getChildState('scriptTask2').taken, 'scriptTask2').to.be.true();
          testHelpers.expectNoLingeringListenersOnDefinition(definition);
          done();
        });
      });
    });

    it('completes process with ending join', (done) => {
      const definitionXml = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="theStart" />
          <parallelGateway id="fork" />
          <parallelGateway id="join" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
          <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
          <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
        </process>
      </definitions>`;

      const engine = new Engine({
        source: definitionXml
      });

      engine.once('end', () => {
        done();
      });

      engine.execute();
    });

    it('completes process with succeeding joins', (done) => {
      const engine = new Engine({
        source: factory.resource('succeeding-joins.bpmn'),
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      const listener = new EventEmitter();
      listener.on('start', (activityApi, processExecution) => {
        if (activityApi.type !== 'bpmn:Process') {
          expect(processExecution.getState().children.filter(c => c.entered).length, `start ${activityApi.id}`).to.be.above(0);
        }
      });

      engine.once('end', () => {
        done();
      });

      engine.execute({
        listener
      });
    });

    describe('resume()', () => {
      it('should continue join', (done) => {
        const definitionXml = `
        <?xml version="1.0" encoding="UTF-8"?>
          <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <process id="theProcess" isExecutable="true">
            <startEvent id="theStart" />
            <parallelGateway id="fork" />
            <userTask id="task1" />
            <userTask id="task2" />
            <parallelGateway id="join" />
            <endEvent id="end" />
            <sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />
            <sequenceFlow id="flow2" sourceRef="fork" targetRef="task1" />
            <sequenceFlow id="flow3" sourceRef="fork" targetRef="task2" />
            <sequenceFlow id="flow4" sourceRef="task1" targetRef="join" />
            <sequenceFlow id="flow5" sourceRef="task2" targetRef="join" />
            <sequenceFlow id="flow6" sourceRef="join" targetRef="end" />
          </process>
        </definitions>`;

        let state;
        const engine = new Engine({
          source: definitionXml
        });
        const listener = new EventEmitter();
        listener.once('wait-task1', (task) => {
          task.signal();
        });

        listener.once('start-join', () => {
          state = engine.getState();
          engine.stop();
        });

        engine.once('end', () => {
          testHelpers.expectNoLingeringListenersOnEngine(engine);

          const listener2 = new EventEmitter();
          listener2.once('wait-task2', (activityApi) => {
            activityApi.signal();
          });
          const engine2 = Engine.resume(state, {
            listener: listener2
          });
          engine2.once('end', () => {
            testHelpers.expectNoLingeringListenersOnEngine(engine2);
            done();
          });
        });

        engine.execute({
          listener
        });

      });
    });
  });
});
