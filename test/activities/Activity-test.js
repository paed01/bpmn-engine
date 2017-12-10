'use strict';

const Environment = require('../../lib/Environment');
const factory = require('../helpers/factory');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

describe('Activity', () => {
  const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
      <startEvent id="start" name="Start" />
      <userTask id="task" />
      <endEvent id="end" />
      <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
      <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
    </process>
  </definitions>`;

  let context;
  beforeEach(async () => {
    context = await testHelpers.context(processXml);
  });

  describe('ctor', () => {
    it('set activity id, type and name', () => {
      const activity = context.getChildActivityById('start');
      expect(activity.id).to.equal('start');
      expect(activity.type).to.equal('bpmn:StartEvent');
      expect(activity.name).to.equal('Start');
    });
  });

  describe('discard()', () => {

    it('activity with multiple inbound waits for all to be discarded', (done) => {
      const engine = new Engine({
        source: factory.multipleInbound()
      });
      const listener = new EventEmitter();
      listener.on('wait-userTask', (activityApi) => {
        activityApi.discard();
      });

      engine.execute({
        listener
      });

      engine.on('end', (execution, definitionExecution) => {
        expect(definitionExecution.getChildState('end').taken).to.be.undefined;
        done();
      });
    });

  });

  describe('activate()', () => {
    it('sets up event activity inbound sequenceFlow listeners', () => {
      const endEvent = context.getChildActivityById('end');
      endEvent.activate();
      expect(endEvent.inbound[0].listenerCount('taken')).to.equal(1);
      expect(endEvent.inbound[0].listenerCount('discarded')).to.equal(1);
    });

    it.skip('sets up event activity inbound sequenceFlow listeners once', () => {
      const endEvent = context.getChildActivityById('end');
      endEvent.activate();
      endEvent.activate();
      expect(context.sequenceFlows[1].listenerCount('taken')).to.equal(1);
      expect(context.sequenceFlows[1].listenerCount('discarded')).to.equal(1);
    });
  });

  describe('deactivate()', () => {
    it('tears down inbound sequenceFlow listeners', () => {
      const endEvent = context.getChildActivityById('end');
      const activity = endEvent.activate();
      activity.deactivate();
      expect(context.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(context.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
    });

    it.skip('tears down inbound sequenceFlow listeners once', () => {
      const endEvent = context.getChildActivityById('end');
      const activity = endEvent.activate();
      activity.deactivate();
      activity.deactivate();
      expect(context.sequenceFlows[0].listenerCount('taken')).to.equal(0);
      expect(context.sequenceFlows[0].listenerCount('discarded')).to.equal(0);
    });
  });

  describe('cancel()', () => {
    it('cancels activity and takes all outbound', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        api.cancel();
      });

      task.once('leave', (activityApi) => {
        expect(activityApi.getState().canceled).to.be.true;
        expect(task.outbound.length).to.be.above(0);
        task.outbound.forEach((f) => expect(f.taken).to.be.true);
        done();
      });

      task.activate().run();
    });

    it('returns cancel flag when getting state', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        api.cancel();
      });

      task.once('leave', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        expect(api.getState().canceled).to.be.true;
        done();
      });

      task.activate().run();
    });

    it('resets cancel flag ran again', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        api.cancel();
      });

      const activity = task.activate();

      task.once('leave', () => {
        task.once('wait', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(api.getState().canceled, 'wait state').to.be.undefined;
          api.signal();
        });
        task.once('leave', (activityApi, activityExecution) => {
          const api = activityApi.getApi(activityExecution);
          expect(api.getState().canceled, 'leave state').to.be.undefined;
          done();
        });

        activity.run();
      });

      activity.run();
    });

    it('sets cancel flag when resumed', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        api.cancel();
      });

      const activity = task.activate();

      task.once('leave', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        const state = api.getState();

        const newContext = context.clone();
        const taskToResume = newContext.getChildActivityById('end');

        expect(taskToResume.activate(state).getState().canceled).to.be.true;
        done();
      });

      activity.run();
    });
  });

  describe('getState()', () => {
    it('returns taken flag if taken', (done) => {
      const end = context.getChildActivityById('end');

      end.once('end', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        expect(api.getState().taken).to.be.true;
        done();
      });

      end.run();
    });
  });

  describe('resume()', () => {
    it('sets taken flag when resumed', (done) => {
      const task = context.getChildActivityById('task');
      task.once('wait', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        api.signal();
      });

      task.once('leave', (activityApi, activityExecution) => {
        const api = activityApi.getApi(activityExecution);
        const state = api.getState();

        const newContext = context.clone(new Environment());
        const taskToResume = newContext.getChildActivityById('end');

        expect(taskToResume.activate(state).getState().taken).to.be.true;
        done();
      });

      task.run();
    });
  });
});
