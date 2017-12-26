'use strict';

const BpmnModdle = require('bpmn-moddle');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

const moddle = new BpmnModdle();

const eventActivities = [
  'bpmn:IntermediateCatchEvent',
  'bpmn:StartEvent',
  'bpmn:EndEvent',
];

const gateways = [
  'bpmn:ExclusiveGateway',
  'bpmn:InclusiveGateway',
];

const activities = [
  'bpmn:Task',
  'bpmn:ScriptTask',
  'bpmn:ServiceTask',
  'bpmn:UserTask',
  'bpmn:SubProcess',
  'bpmn:ParallelGateway',
];

describe('activities', () => {
  describe('activity api', () => {
    eventActivities.concat(gateways).concat(activities).forEach((activityType) => {

      it(activityType, async () => {
        const source = await SimpleDefinition(activityType);

        const engine = Engine({
          name: `Test ${activityType}`,
          source
        });

        const listener = new EventEmitter();
        const apiEvent = [];

        listener.on('enter-activity', (api) => {
          if (apiEvent.includes('enter')) throw new Error(`${activityType} too many enter`);
          apiEvent.push('enter');
          assertApi(api, {
            id: 'activity',
            type: activityType,
            entered: true
          });
        });

        listener.on('start-activity', (api) => {
          if (apiEvent.includes('start')) throw new Error(`${activityType} too many start`);
          apiEvent.push('start');
          assertApi(api, {
            id: 'activity',
            type: activityType,
            entered: true
          });
        });

        listener.on('end-activity', (api) => {
          if (apiEvent.includes('end')) throw new Error(`${activityType} too many end`);
          apiEvent.push('end');
          assertApi(api, {
            id: 'activity',
            type: activityType,
            taken: true
          });
        });

        listener.on('leave-activity', (api) => {
          if (apiEvent.includes('leave')) throw new Error(`${activityType} too many leave`);
          apiEvent.push('leave');
          assertApi(api, {
            id: 'activity',
            type: activityType,
            entered: undefined
          });
        });

        listener.on('wait-activity', (api) => {
          api.signal();
          assertApi(api);
        });
        const execution = engine.execute({listener});

        await execution.waitFor('end');

        expect(apiEvent).to.eql(['enter', 'start', 'end', 'leave']);
        testHelpers.expectNoLingeringListenersOnEngine(engine);
      });

      function assertApi(activityApi, compareState) {
        expect(activityApi).to.have.property('id', 'activity');

        expect(activityApi).to.have.property('type', activityType);
        expect(activityApi).to.have.property('cancel').that.is.a('function');
        expect(activityApi).to.have.property('discard').that.is.a('function');
        expect(activityApi).to.have.property('getInput').that.is.a('function');
        expect(activityApi).to.have.property('getOutput').that.is.a('function');
        expect(activityApi).to.have.property('signal').that.is.a('function');
        expect(activityApi).to.have.property('getState').that.is.a('function');

        if (compareState) {
          expect(activityApi.getState()).to.deep.include(compareState);
        }
      }
    });
  });

  describe('on inbound', () => {
    activities.concat(gateways).forEach((activityType) => {
      describe(activityType, () => {
        let source;
        before(async () => {
          source = await FlowDefinition(activityType);
        });

        it('executes on inbound taken', async () => {
          const engine = Engine({
            name: `Test ${activityType}`,
            source
          });

          const listener = new EventEmitter();
          const apiEvent = [];

          listener.on('enter-activity', () => {
            apiEvent.push('enter');
          });

          listener.on('start-activity', () => {
            apiEvent.push('start');
          });

          listener.on('end-activity', () => {
            apiEvent.push('end');
          });

          listener.on('leave-activity', () => {
            apiEvent.push('leave');
          });

          listener.on('wait-activity', (api) => {
            api.signal();
          });
          const execution = engine.execute({listener});

          await execution.waitFor('end');

          expect(apiEvent).to.eql(['enter', 'start', 'end', 'leave']);
        });

        it('discards if inbound discarded', async () => {
          const engine = Engine({
            name: `Test ${activityType}`,
            source
          });

          const listener = new EventEmitter();

          listener.on('enter-start', (api) => {
            api.discard();
          });

          listener.on('start-activity', () => {
            throw new Error(`${activityType} should not have been started`);
          });

          const execution = engine.execute({listener});

          await execution.waitFor('end');
        });
      });
    });
  });
});

async function SimpleDefinition(activityType) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <bpmn2:definitions id="task-definitions" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
  </bpmn2:definitions>'`;

  const {definitions} = await fromXML(source);

  const bpmnProcess = moddle.create('bpmn:Process', {
    id: 'Process_1',
    isExecutable: true,
    flowElements: [
      moddle.create(activityType, { id: 'activity' })
    ]
  });

  definitions.get('rootElements').push(bpmnProcess);

  return toXml(definitions);
}

async function FlowDefinition(activityType) {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <bpmn2:definitions id="task-definitions" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
  </bpmn2:definitions>'`;

  const {definitions} = await fromXML(source);

  const flowElements = [
    moddle.create('bpmn:StartEvent', {id: 'start'}),
    moddle.create(activityType, { id: 'activity' }),
    moddle.create('bpmn:EndEvent', {id: 'end1'}),
    moddle.create('bpmn:EndEvent', {id: 'end2'})
  ];

  const [start, activity, end1, end2] = flowElements;

  const flows = [
    moddle.create('bpmn:SequenceFlow', {id: 'flow1', sourceRef: start, targetRef: activity}),
    moddle.create('bpmn:SequenceFlow', {id: 'flow2', sourceRef: activity, targetRef: end1}),
    moddle.create('bpmn:SequenceFlow', {id: 'flow3', sourceRef: activity, targetRef: end2}),
  ];
  const [, flow2, flow3] = flows;

  if (gateways.includes(activityType)) {
    activity.set('default', flow2);
    const conditionExpression = moddle.create('bpmn:FormalExpression', {
      body: '${variables.take}'
    });
    flow3.set('conditionExpression', conditionExpression);
  }

  const bpmnProcess = moddle.create('bpmn:Process', {
    id: 'Process_1',
    isExecutable: true,
    flowElements: flowElements.concat(flows)
  });

  definitions.get('rootElements').push(bpmnProcess);

  return toXml(definitions);
}

function fromXML(source) {
  return new Promise((resolve, reject) => {
    moddle.fromXML(source, (err, definitions, moddleContext) => {
      if (err) return reject(err);
      return resolve({
        definitions,
        moddleContext
      });
    });
  });
}

function toXml(definitions) {
  return new Promise((resolve, reject) => {
    moddle.toXML(definitions, (err, source) => {
      if (err) return reject(err);
      return resolve(source);
    });
  });
}
