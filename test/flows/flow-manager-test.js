'use strict';

const FlowManager = require('../../lib/flows/flow-manager');
const testHelper = require('../helpers/testHelpers');

describe('Flow manager', () => {
  let context;
  beforeEach(async () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess1" isExecutable="true">
        <startEvent id="start" />
        <exclusiveGateway id="gateway" default="flow2" />
        <parallelGateway id="join" />
        <endEvent id="end1" />
        <endEvent id="end2" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="gateway" />
        <sequenceFlow id="flow2" sourceRef="gateway" targetRef="join" />
        <sequenceFlow id="flow3" sourceRef="gateway" targetRef="join">
          <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
            this.variables.input = 1;
            this.variables.input < 2
          ]]></conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow4" sourceRef="join" targetRef="end1" />
        <sequenceFlow id="flow5" sourceRef="join" targetRef="end2" />
      </process>
    </definitions>`;

    context = await testHelper.context(source);
    expect(context.sequenceFlows.length).to.be.above(0);
  });

  describe('only outbound', () => {
    it('flow manager is activated when activity is activated', () => {
      const activity = context.getChildActivityById('start');
      expect(activity.flows).to.be.ok;
      activity.activate();
      expect(activity.flows.getState()).to.not.have.property('pendingInbound');
      expect(activity.flows.getState()).to.have.property('pendingOutbound').with.length(1);
    });

    it('listener count should be once per taken/discarded', () => {
      const activity = context.getChildActivityById('start');
      const flows = activity.flows;
      activity.activate();

      expect(flows.outbound[0].listenerCount('taken')).to.equal(1);
      expect(flows.outbound[0].listenerCount('discarded')).to.equal(1);
    });
  });

  describe('only inbound', () => {
    it('flow manager is activated when activity is activated', () => {
      const activity = context.getChildActivityById('end1');
      expect(activity.flows).to.be.ok;
      activity.activate();
      expect(activity.flows.getState()).to.not.have.property('pendingOutbound');
      expect(activity.flows.getState()).to.have.property('pendingInbound').with.length(1);
    });

    it('listener count should be once per taken/discarded', () => {
      const activity = context.getChildActivityById('end1');
      const flows = activity.flows;
      activity.activate();

      expect(flows.inbound[0].listenerCount('taken')).to.equal(1);
      expect(flows.inbound[0].listenerCount('discarded')).to.equal(1);
    });
  });

  describe('multiple outbound', () => {
    it('flow manager is activated when activity is activated', () => {
      const activity = context.getChildActivityById('gateway');
      expect(activity.flows).to.be.ok;
      activity.activate();
      expect(activity.flows.getState()).to.have.property('pendingInbound').with.length(1);
      expect(activity.flows.getState()).to.have.property('pendingOutbound').with.length(2);
    });

    it('listener count should be once per taken/discarded', () => {
      const activity = context.getChildActivityById('gateway');
      const flows = activity.flows;
      activity.activate();

      flows.inbound.forEach((flow) => {
        expect(flow.listenerCount('taken')).to.equal(1);
        expect(flow.listenerCount('discarded')).to.equal(1);
      });
      flows.outbound.forEach((flow) => {
        expect(flow.listenerCount('taken')).to.equal(1);
        expect(flow.listenerCount('discarded')).to.equal(1);
      });
    });
  });

  describe('multiple inbound', () => {
    it('flow manager is activated when activity is activated', () => {
      const activity = context.getChildActivityById('join');
      expect(activity.flows).to.be.ok;
      activity.activate();
      expect(activity.flows.getState()).to.have.property('pendingInbound').with.length(2);
      expect(activity.flows.getState()).to.have.property('pendingOutbound').with.length(2);
    });

    it('listener count should be once per taken/discarded', () => {
      const activity = context.getChildActivityById('join');
      const flows = activity.flows;
      activity.activate();

      flows.inbound.forEach((flow) => {
        expect(flow.listenerCount('taken')).to.equal(1);
        expect(flow.listenerCount('discarded')).to.equal(1);
      });
      flows.outbound.forEach((flow) => {
        expect(flow.listenerCount('taken')).to.equal(1);
        expect(flow.listenerCount('discarded')).to.equal(1);
      });
    });

    it('resumed listener with pending inbound should be once per pending', () => {
      const activity = context.getChildActivityById('join');
      const flows = activity.flows;

      flows.resume({
        pendingInbound: ['flow2']
      });

      const pending = [];
      flows.inbound.forEach((flow) => {
        if (flow.id === 'flow2') {
          pending.push(flow.id);
          expect(flow.listenerCount('taken')).to.equal(1);
          expect(flow.listenerCount('discarded')).to.equal(1);
        }
      });

      expect(pending).to.eql(['flow2']);
    });

    it('resumed listener with pending inbound should not have listener for non-pending', () => {
      const activity = context.getChildActivityById('join');
      const flows = activity.flows;

      flows.resume({
        pendingInbound: ['flow2']
      });

      const nonPending = [];
      flows.inbound.forEach((flow) => {
        if (flow.id !== 'flow2') {
          nonPending.push(flow.id);
          expect(flow.listenerCount('taken')).to.equal(0);
          expect(flow.listenerCount('discarded')).to.equal(0);
        }
      });

      expect(nonPending).to.eql(['flow3']);
    });
  });

  describe('state', () => {
    it('inactive returns empty state', () => {
      const activity = context.getChildActivityById('gateway');
      expect(activity.flows.getState()).to.eql({});
    });

    it('active returns pending inbound and outbound', () => {
      const activity = context.getChildActivityById('gateway');
      activity.activate();
      const state = activity.flows.getState();
      expect(state).to.have.property('pendingInbound');
      expect(state).to.have.property('pendingOutbound');
    });

    it('resumed with inbound taken sets pending inbound and outbound', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      activity.activate();

      flows.on('inbound-taken', () => {
        const flowManager = FlowManager(activity);
        flowManager.resume(flows.getState());

        expect(flowManager.getState()).to.have.property('pendingInbound').with.length(1);
        done();
      });

      activity.flows.inbound[0].take();
    });

    it('resumed with inbound discarded sets discarded inbound', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      activity.activate();

      flows.on('inbound-discarded', () => {
        const flowManager = FlowManager(activity);
        flowManager.resume(flows.getState());

        expect(flowManager.getState()).to.have.property('discardedInbound').with.length(1);
        expect(flowManager.getState()).to.have.property('pendingInbound').with.length(1);
        done();
      });

      activity.flows.inbound[0].discard();
    });

    it('resumed with all inbound discarded sets discarded', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      activity.activate();

      flows.on('all-inbound-discarded', () => {
        const flowManager = FlowManager(activity);
        flowManager.resume(flows.getState());

        expect(flowManager.getState()).to.have.property('discardedInbound').with.length(2);
        expect(flowManager.getState()).to.not.have.property('pendingInbound');
        done();
      });

      activity.flows.inbound[0].discard();
      activity.flows.inbound[1].discard();
    });

    it('resumed with outbound taken sets pending outbound', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      activity.activate();

      flows.on('outbound-taken', () => {
        const flowManager = FlowManager(activity);
        flowManager.resume(flows.getState());

        expect(flowManager.getState()).to.not.have.property('pendingInbound');
        expect(flowManager.getState()).to.have.property('pendingOutbound').with.length(1);
        done();
      });

      activity.flows.inbound[0].take();
      activity.flows.inbound[1].take();
    });
  });

  describe('events', () => {
    it('taken inbound emits inbound-taken', (done) => {
      const activity = context.getChildActivityById('gateway');
      const {flows} = activity;
      activity.activate();
      flows.on('inbound-taken', () => {
        expect(flows.getState()).to.not.have.property('pendingInbound');
        expect(flows.getState()).to.have.property('pendingOutbound').with.length(2);
        done();
      });
      flows.inbound[0].take();
    });

    it('discarded inbound emits inbound-discarded', (done) => {
      const activity = context.getChildActivityById('gateway');
      const {flows} = activity;
      activity.activate();
      flows.on('inbound-discarded', () => {
        expect(flows.getState()).to.have.property('discardedInbound').with.length(1);
        expect(flows.getState()).to.have.property('pendingOutbound').with.length(2);
        done();
      });
      flows.inbound[0].discard();
    });

    it.skip('no inbound emits all inbound taken event', (done) => {
      const activity = context.getChildActivityById('start');
      const {flows} = activity;
      activity.activate();
      flows.on('inbound-taken', () => {
        throw new Error('inbound-taken should not be emitted');
      });
      flows.on('all-inbound-taken', () => {
        expect(flows.getState()).to.have.property('pendingOutbound').with.length(1);
        done();
      });
    });

    it('all inbound discarded emits event', (done) => {
      const activity = context.getChildActivityById('gateway');
      const {flows} = activity;
      activity.activate();
      flows.on('all-inbound-discarded', () => {
        expect(flows.getState()).to.have.property('discardedInbound').with.length(1);
        expect(flows.getState()).to.have.property('pendingOutbound').with.length(2);
        done();
      });
      flows.inbound[0].discard();
    });

    it('discarded outbound emits event', (done) => {
      const activity = context.getChildActivityById('gateway');
      const {flows} = activity;
      activity.activate();
      flows.on('outbound-discarded', () => {
        expect(flows.getState()).to.have.property('pendingOutbound').with.length(1);
        expect(flows.getState()).to.have.property('discardedOutbound').with.length(1);
        done();
      });
      flows.inbound[0].discard();
    });

    it('all outbound discarded emits event', (done) => {
      const activity = context.getChildActivityById('gateway');
      const {flows} = activity;
      activity.activate();
      flows.on('all-outbound-discarded', () => {
        expect(flows.getState()).to.not.have.property('pendingOutbound');
        expect(flows.getState()).to.have.property('discardedOutbound').with.length(2);
        done();
      });
      flows.inbound[0].discard();
    });

    it('all outbound taken emits all outbound taken event', (done) => {
      const activity = context.getChildActivityById('start');
      const {flows} = activity;
      activity.activate();
      flows.on('all-outbound-taken', () => {
        expect(flows.getState()).to.not.have.property('pendingOutbound');
        done();
      });
      flows.takeAllOutbound();
    });

    it.skip('no outbound emits all outbound taken event', (done) => {
      const activity = context.getChildActivityById('end1');
      const {flows} = activity;
      activity.activate();
      flows.on('all-outbound-taken', () => {
        expect(flows.getState()).to.not.have.property('pendingOutbound');
        done();
      });
    });

    it.skip('resumed with pending inbound emits inbound taken for last inbound taken', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;

      flows.resume({
        pendingInbound: ['flow3'],
        pendingOutbound: ['flow4', 'flow5']
      });

      flows.on('inbound-taken', (flow) => {
        expect(flow.id).to.equal('flow2');
        done();
      });
    });

    it.skip('resumed with discarded inbound emits inbound discarded for last inbound discarded', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;

      flows.resume({
        discardedInbound: ['flow3'],
        pendingInbound: ['flow2'],
        pendingOutbound: ['flow4', 'flow5']
      });

      flows.on('inbound-discarded', (flow) => {
        expect(flow.id).to.equal('flow3');
        done();
      });
    });

    it('resumed with discarded inbound and resumed pending is also discarded emits all inbound discarded', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;

      flows.resume({
        discardedInbound: ['flow2'],
        pendingInbound: ['flow3'],
        pendingOutbound: ['flow4', 'flow5']
      });

      flows.on('all-inbound-discarded', (flow) => {
        expect(flow.id).to.equal('flow3');
        done();
      });

      flows.inbound[1].discard();
    });

    it('discard all outbound emits all outbound discarded', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      flows.activate();

      flows.on('all-outbound-discarded', () => {
        done();
      });

      flows.discardAllOutbound();
    });

    it.skip('no outbound emits all outbound taken', (done) => {
      const activity = context.getChildActivityById('end2');
      const {flows} = activity;

      flows.on('outbound-taken', () => {
        throw new Error('outbound-taken should not be emitted');
      });
      flows.on('all-outbound-taken', () => {
        done();
      });

      flows.activate();
    });
  });

  describe('pending', () => {
    it('returns all inbound and outbound flows if not taken', () => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      flows.activate();

      expect(flows.pending().inbound).to.eql(flows.inbound);
      expect(flows.pending().outbound).to.eql(flows.outbound);
    });

    it('returns pending inbound and outbound flows', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      flows.activate();

      flows.on('inbound-taken', () => {
        expect(flows.pending().inbound).to.eql([flows.inbound[1]]);
        expect(flows.pending().outbound).to.eql(flows.outbound);
        done();
      });

      flows.inbound[0].take();
    });

    it('returns no pending inbound if all taken', (done) => {
      const activity = context.getChildActivityById('join');
      const {flows} = activity;
      flows.activate();

      flows.on('all-inbound-taken', () => {
        expect(flows.pending().inbound).to.be.undefined;
        expect(flows.pending().outbound).to.eql(flows.outbound);
        done();
      });

      flows.inbound[0].take();
      flows.inbound[1].take();
    });

    it('reduces outbound if outbound taken', (done) => {
      const activity = context.getChildActivityById('gateway');
      const {flows} = activity;
      flows.activate();

      flows.on('outbound-taken', () => {
        expect(flows.pending().inbound).to.be.undefined;
        expect(flows.pending().outbound).to.eql([flows.outbound[1]]);
        done();
      });

      flows.inbound[0].take();
      flows.outbound[0].take();
    });
  });
});
