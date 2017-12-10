'use strict';

const {Engine} = require('../');
const {EventEmitter} = require('events');

describe('listener emits expected event sequence', () => {
  it('for simple process', (done) => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" name="Start" />
        <userTask id="task" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
        <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
      </process>
    </definitions>`;

    const eventSequence = [];
    const listener = new EventEmitter();

    ['enter', 'start', 'wait', 'end', 'leave'].forEach((evenName) => {
      listener.on(evenName, (a) => {
        eventSequence.push(`${evenName}-${a.id}`);
        if (evenName === 'wait') {
          setTimeout(a.signal.bind(a), 2);
        }
      });
    });

    const engine = new Engine({
      source
    });
    engine.execute({
      listener
    });

    engine.once('start', (execution, definitionExecution) => {
      definitionExecution.processes[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
      });
    });
    engine.once('end', () => {
      expect(eventSequence).to.eql([
        'enter-theProcess',
        'start-theProcess',
        'enter-start',
        'start-start',
        'end-start',
        'enter-task',
        'start-task',
        'wait-task',
        'taken-flow1',
        'leave-start',
        'end-task',
        'enter-end',
        'start-end',
        'end-end',
        'taken-flow2',
        'leave-task',
        'leave-end'
      ]);
      done();
    });
  });

  it('for a parallel gateway fork and join', (done) => {
    const source =
    `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <parallelGateway id="fork" />
        <parallelGateway id="join" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="fork" />
        <sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />
        <sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />
        <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
      </process>
    </definitions>`;

    const eventSequence = [];
    const listener = new EventEmitter();

    ['enter', 'start', 'wait', 'end', 'leave'].forEach((evenName) => {
      listener.on(evenName, (a) => {
        eventSequence.push(`${evenName}-${a.id}`);
        if (evenName === 'wait') {
          setTimeout(a.signal.bind(a), 2);
        }
      });
    });

    const engine = new Engine({
      source
    });
    engine.execute({
      listener
    });

    engine.once('start', (execution, definitionExecution) => {
      definitionExecution.processes[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
      });
    });
    engine.once('end', () => {
      expect(eventSequence).to.eql([
        'enter-theProcess',
        'start-theProcess',
        'enter-start',
        'start-start',
        'end-start',
        'enter-fork',
        'start-fork',
        'taken-flow1',
        'leave-start',
        'enter-join',
        'start-join',
        'taken-flow2',
        'start-join',
        'end-join',
        'taken-flow3',
        'end-fork',
        'enter-end',
        'start-end',
        'end-end',
        'taken-flow4',
        'leave-join',
        'leave-fork',
        'leave-end'
      ]);
      done();
    });
  });

  it('for a exclusive gateway', (done) => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <exclusiveGateway id="decision" default="flow3" />
        <parallelGateway id="join" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
        <sequenceFlow id="flow2" sourceRef="decision" targetRef="join">
          <conditionExpression xsi:type="tFormalExpression">\${variables.takeCondition}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow3" sourceRef="decision" targetRef="join" />
        <sequenceFlow id="flow4" sourceRef="join" targetRef="end" />
      </process>
    </definitions>`;

    const eventSequence = [];
    const listener = new EventEmitter();

    ['enter', 'start', 'wait', 'end', 'leave'].forEach((evenName) => {
      listener.on(evenName, (a) => {
        eventSequence.push(`${evenName}-${a.id}`);
        if (evenName === 'wait') {
          setTimeout(a.signal.bind(a), 2);
        }
      });
    });

    const engine = new Engine({
      source
    });
    engine.execute({
      listener
    });

    engine.once('start', (execution, definitionExecution) => {
      definitionExecution.processes[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
      });
    });

    engine.once('end', () => {
      expect(eventSequence).to.eql([
        'enter-theProcess',
        'start-theProcess',
        'enter-start',
        'start-start',
        'end-start',
        'enter-decision',
        'start-decision',
        'end-decision',
        'taken-flow1',
        'leave-start',
        'enter-join',
        'start-join',
        'end-join',
        'taken-flow3',
        'leave-decision',
        'enter-end',
        'start-end',
        'end-end',
        'taken-flow4',
        'leave-join',
        'leave-end'
      ]);
      done();
    });
  });

  it('for an inclusive gateway', (done) => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <inclusiveGateway id="decisions" default="flow4" />
        <parallelGateway id="join" />
        <endEvent id="end" />
        <sequenceFlow id="flow1" sourceRef="start" targetRef="decisions" />
        <sequenceFlow id="flow2" sourceRef="decisions" targetRef="join">
          <conditionExpression xsi:type="tFormalExpression">\${services.checksum(variables.sum,2)}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow3" sourceRef="decisions" targetRef="join">
          <conditionExpression xsi:type="tFormalExpression">\${services.checksum(variables.sum,1)}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow4" sourceRef="decisions" targetRef="join" />
        <sequenceFlow id="flow5" sourceRef="join" targetRef="end" />
      </process>
    </definitions>`;

    const eventSequence = [];
    const listener = new EventEmitter();

    ['enter', 'start', 'wait', 'end', 'leave'].forEach((evenName) => {
      listener.on(evenName, (a) => {
        eventSequence.push(`${evenName}-${a.id}`);
        if (evenName === 'wait') {
          setTimeout(a.signal.bind(a), 2);
        }
      });
    });

    const engine = new Engine({
      source
    });
    engine.execute({
      listener,
      variables: {
        sum: 0
      },
      services: {
        checksum: (sum, compare) => Number(compare) > sum
      }
    });

    engine.once('start', (execution, definitionExecution) => {
      definitionExecution.processes[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });
    });

    engine.once('end', () => {
      expect(eventSequence).to.eql([
        'enter-theProcess',
        'start-theProcess',
        'enter-start',
        'start-start',
        'end-start',
        'enter-decisions',
        'start-decisions',
        'end-decisions',
        'taken-flow1',
        'leave-start',
        'enter-join',
        'start-join',
        'taken-flow2',
        'start-join',
        'taken-flow3',
        'end-join',
        'discarded-flow4',
        'leave-decisions',
        'enter-end',
        'start-end',
        'end-end',
        'taken-flow5',
        'leave-join',
        'leave-end'
      ]);
      done();
    });
  });

  it('for a discarded parallel join gateway', (done) => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <exclusiveGateway id="decision" default="flow4" />
        <parallelGateway id="join" />
        <endEvent id="end" />
        <endEvent id="terminate">
          <terminateEventDefinition />
        </endEvent>
        <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
        <sequenceFlow id="flow2" sourceRef="decision" targetRef="join">
          <conditionExpression xsi:type="tFormalExpression">\${variables.takeCondition1}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow3" sourceRef="decision" targetRef="join">
          <conditionExpression xsi:type="tFormalExpression">\${variables.takeCondition2}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow4" sourceRef="decision" targetRef="end" />
        <sequenceFlow id="flow5" sourceRef="join" targetRef="terminate" />
      </process>
    </definitions>`;

    const eventSequence = [];
    const listener = new EventEmitter();

    ['enter', 'start', 'wait', 'end', 'leave'].forEach((evenName) => {
      listener.on(evenName, (a) => {
        eventSequence.push(`${evenName}-${a.id}`);
        if (evenName === 'wait') {
          setTimeout(a.signal.bind(a), 2);
        }
      });
    });

    const engine = new Engine({
      source
    });
    engine.execute({
      listener
    });

    engine.once('start', (execution, definitionExecution) => {
      definitionExecution.processes[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });
    });

    engine.once('end', () => {
      expect(eventSequence).to.eql([
        'enter-theProcess',
        'start-theProcess',
        'enter-start',
        'start-start',
        'end-start',
        'enter-decision',
        'start-decision',
        'end-decision',
        'taken-flow1',
        'leave-start',
        'enter-join',
        'discarded-flow2',
        'leave-join',
        'discarded-flow3',
        'enter-end',
        'start-end',
        'end-end',
        'taken-flow4',
        'enter-terminate',
        'leave-terminate',
        'discarded-flow5',
        'leave-decision',
        'leave-end'
      ]);
      done();
    });
  });

  it('for a discarded parallel fork gateway', (done) => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <startEvent id="start" />
        <exclusiveGateway id="decision" default="flow3" />
        <parallelGateway id="fork" />
        <endEvent id="end" />
        <endEvent id="end2" />
        <endEvent id="terminate">
          <terminateEventDefinition />
        </endEvent>
        <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
        <sequenceFlow id="flow2" sourceRef="decision" targetRef="fork">
          <conditionExpression xsi:type="tFormalExpression">\${variables.takeCondition1}</conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow3" sourceRef="decision" targetRef="end" />
        <sequenceFlow id="flow4" sourceRef="fork" targetRef="end2" />
        <sequenceFlow id="flow5" sourceRef="fork" targetRef="terminate" />
      </process>
    </definitions>`;

    const eventSequence = [];
    const listener = new EventEmitter();

    ['enter', 'start', 'wait', 'end', 'leave'].forEach((evenName) => {
      listener.on(evenName, (a) => {
        eventSequence.push(`${evenName}-${a.id}`);
        if (evenName === 'wait') {
          setTimeout(a.signal.bind(a), 2);
        }
      });
    });

    const engine = new Engine({
      source
    });
    engine.execute({
      listener
    });

    engine.once('start', (execution, definitionExecution) => {
      definitionExecution.processes[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });
    });

    engine.once('end', () => {
      expect(eventSequence).to.eql([
        'enter-theProcess',
        'start-theProcess',
        'enter-start',
        'start-start',
        'end-start',
        'enter-decision',
        'start-decision',
        'end-decision',
        'taken-flow1',
        'leave-start',
        'enter-fork',
        'leave-fork',
        'discarded-flow2',
        'enter-end',
        'start-end',
        'end-end',
        'taken-flow3',
        'enter-end2',
        'leave-end2',
        'discarded-flow4',
        'enter-terminate',
        'leave-terminate',
        'discarded-flow5',
        'leave-decision',
        'leave-end'
      ]);
      done();
    });
  });
});
