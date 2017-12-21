'use strict';

const factory = require('../helpers/factory');
const SequenceFlow = require('../../lib/mapper')('bpmn:SequenceFlow');
const testHelper = require('../helpers/testHelpers');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

describe('SequenceFlow', () => {
  let context;
  before(async () => {
    context = await testHelper.context(factory.resource('multiple-multiple-inbound.bpmn').toString());
    expect(context.sequenceFlows.length).to.be.above(0);
  });

  describe('properties', () => {
    it('has source and target id', (done) => {
      context.sequenceFlows.forEach((f) => {
        expect(f.targetId).to.exist;
        expect(f.sourceId).to.exist;
      });
      done();
    });
  });

  describe('discard', () => {
    it('emit looped if root flow is the same as discard flow', (done) => {
      const rootFlow = getFlowById(context, 'condflow-1');
      const flow = getFlowById(context, 'taskflow-1');
      flow.once('looped', () => {
        done();
      });
      flow.discard(rootFlow);
    });
  });

  describe('condition', () => {
    it('throws if script type is not JavaScript', () => {
      const activity = {
        element: {
          id: 'flow',
          $type: 'bpmn:SequenceFlow',
          conditionExpression: {
            language: 'Java'
          }
        }
      };

      function test() {
        new SequenceFlow(activity, context);
      }

      expect(test).to.throw(Error, /Java is unsupported/i);
    });

    it('condition cannot alter variables (or at least shallow)', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess1" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" default="flow2" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
          <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
              this.variables.input = 1;
              this.variables.input < 2
            ]]></conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('taken-flow3', (flow) => {
        expect.fail(`<${flow.id}> should not have been taken`);
      });

      engine.execute({
        listener: listener,
        variables: {
          input: 3
        }
      });

      engine.once('end', () => {
        done();
      });
    });

    it('resolves variable expression', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess1" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" default="flow2" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
          <sequenceFlow id="flow3withExpression" sourceRef="decision" targetRef="end2">
            <conditionExpression xsi:type="tFormalExpression">\${variables.isOk}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('taken-flow3withExpression', (flow) => {
        expect.fail(`<${flow.id}> should not have been taken`);
      });

      engine.execute({
        listener,
        variables: {
          isOk: false
        }
      });
      engine.once('end', () => {
        done();
      });
    });

    it('executes service expression', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess1" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" default="flow2" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
          <sequenceFlow id="flow3withExpression" sourceRef="decision" targetRef="end2">
            <conditionExpression>\${services.isBelow(variables.input,2)}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('taken-flow3withExpression', (flow) => {
        expect.fail(`<${flow.id}> should not have been taken`);
      });

      engine.execute({
        listener,
        services: {
          isBelow: (input, test) => {
            return input < Number(test);
          }
        },
        variables: {
          input: 2
        }
      });

      engine.once('end', () => {
        done();
      });
    });
  });

  describe('engine', () => {
    it('stops on infinite loop detection', (done) => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess1" isExecutable="true">
          <startEvent id="theStart" />
          <exclusiveGateway id="decision" default="flow2" />
          <task id="task" />
          <endEvent id="end1" />
          <endEvent id="end2" />
          <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
          <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
          <sequenceFlow id="flow3withExpression" sourceRef="decision" targetRef="end2">
            <conditionExpression>\${services.isBelow(variables.input,2)}</conditionExpression>
          </sequenceFlow>
        </process>
      </definitions>`;

      const engine = new Engine({
        source
      });
      const listener = new EventEmitter();

      listener.on('taken-flow3withExpression', (flow) => {
        expect.fail(`<${flow.id}> should not have been taken`);
      });

      engine.execute({
        listener,
        services: {
          isBelow: (input, test) => {
            return input < Number(test);
          }
        },
        variables: {
          input: 2
        }
      });
      engine.once('end', () => {
        done();
      });
    });

    it('stops if flow lacks id', async () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess1" isExecutable="true">
          <startEvent id="start" />
          <task id="task" />
          <endEvent id="end" />
          <sequenceFlow sourceRef="start" targetRef="task" />
          <sequenceFlow sourceRef="task" targetRef="end" />
        </process>
      </definitions>`;

      const engine = new Engine({
        name: 'flow without id',
        source
      });
      const listener = new EventEmitter();

      let count = 0;
      listener.on('start-task', (api) => {
        count++;
        if (count > 2) {
          expect.fail(`<${api.id}> should only start once`);
        }
      });

      const execution = engine.execute({
        listener,
        services: {
          isBelow: (input, test) => {
            return input < Number(test);
          }
        },
        variables: {
          input: 2
        }
      });

      await execution.waitFor('end');
    });

  });
});

function getFlowById(context, id) {
  return context.sequenceFlows.find((f) => f.id === id);
}
