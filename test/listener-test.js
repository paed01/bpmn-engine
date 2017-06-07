'use strict';

const Code = require('code');
const Lab = require('lab');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Bpmn = require('../');

lab.experiment('listener', () => {
  lab.test('emits expected event sequence', (done) => {
    const processXml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute({
      listener
    }, (err, instance) => {
      if (err) return done(err);
      instance.getProcesses()[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
      });

      instance.once('end', () => {
        expect(eventSequence).to.equal(['enter-start',
          'start-start',
          'end-start',
          'taken-flow1',
          'enter-task',
          'start-task',
          'wait-task',
          'leave-start',
          'end-task',
          'taken-flow2',
          'enter-end',
          'start-end',
          'leave-task',
          'end-end',
          'leave-end'
        ]);
        done();
      });
    });
  });

  lab.test('emits expected event sequence for a parallel gateway fork and join', (done) => {
    const processXml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute({
      listener
    }, (err, instance) => {
      if (err) return done(err);
      instance.getProcesses()[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
      });

      instance.once('end', () => {
        expect(eventSequence).to.equal([
          'enter-start',
          'start-start',
          'end-start',
          'taken-flow1',
          'enter-fork',
          'start-fork',
          'leave-start',
          'taken-flow2',
          'enter-join',
          'start-join',
          'taken-flow3',
          'start-join',
          'end-fork',
          'taken-flow4',
          'enter-end',
          'start-end',
          'leave-fork',
          'end-end',
          'end-join',
          'leave-end',
          'leave-join',
        ]);
        done();
      });
    });
  });

  lab.test('emits expected event sequence for a exclusive gateway', (done) => {
    const processXml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute({
      listener
    }, (err, instance) => {
      if (err) return done(err);
      instance.getProcesses()[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });

      instance.once('end', () => {
        expect(eventSequence).to.equal([
          'enter-start',
          'start-start',
          'end-start',
          'taken-flow1',
          'enter-decision',
          'start-decision',
          'leave-start',
          'discarded-flow2',
          'enter-join',
          'taken-flow3',
          'start-join',
          'end-decision',
          'taken-flow4',
          'enter-end',
          'start-end',
          'leave-decision',
          'end-end',
          'end-join',
          'leave-end',
          'leave-join'
        ]);
        done();
      });
    });
  });

  lab.test('emits expected event sequence for an inclusive gateway', (done) => {
    const processXml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute({
      listener,
      variables: {
        sum: 0
      },
      services: {
        checksum: (sum, compare) => Number(compare) > sum
      }
    }, (err, instance) => {
      if (err) return done(err);
      instance.getProcesses()[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });

      instance.once('end', () => {
        expect(eventSequence).to.equal([
          'enter-start',
          'start-start',
          'end-start',
          'taken-flow1',
          'enter-decisions',
          'start-decisions',
          'leave-start',
          'taken-flow2',
          'enter-join',
          'start-join',
          'taken-flow3',
          'start-join',
          'discarded-flow4',
          'end-decisions',
          'taken-flow5',
          'enter-end',
          'start-end',
          'leave-decisions',
          'end-end',
          'end-join',
          'leave-end',
          'leave-join',
        ]);
        done();
      });
    });
  });

  lab.test('emits expected event sequence for a discarded parallel join gateway', (done) => {
    const processXml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute({
      listener
    }, (err, instance) => {
      if (err) return done(err);
      instance.getProcesses()[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });

      instance.once('end', () => {
        expect(eventSequence).to.equal([
          'enter-start',
          'start-start',
          'end-start',
          'taken-flow1',
          'enter-decision',
          'start-decision',
          'leave-start',
          'discarded-flow2',
          'enter-join',
          'discarded-flow3',
          'taken-flow4',
          'enter-end',
          'start-end',
          'leave-join',
          'discarded-flow5',
          'enter-terminate',
          'end-end',
          'end-decision',
          'leave-terminate',
          'leave-end',
          'leave-decision'
        ]);
        done();
      });
    });
  });

  lab.test('emits expected event sequence for a discarded parallel fork gateway', (done) => {
    const processXml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const engine = new Bpmn.Engine({
      source: processXml
    });
    engine.execute({
      listener
    }, (err, instance) => {
      if (err) return done(err);
      instance.getProcesses()[0].context.sequenceFlows.forEach((flow) => {
        flow.on('taken', (f) => {
          eventSequence.push(`taken-${f.id}`);
        });
        flow.on('discarded', (f) => {
          eventSequence.push(`discarded-${f.id}`);
        });
      });

      instance.once('end', () => {
        expect(eventSequence).to.equal([
          'enter-start',
          'start-start',
          'end-start',
          'taken-flow1',
          'enter-decision',
          'start-decision',
          'leave-start',
          'discarded-flow2',
          'enter-fork',
          'taken-flow3',
          'enter-end',
          'start-end',
          'leave-fork',
          'discarded-flow4',
          'enter-end2',
          'discarded-flow5',
          'enter-terminate',
          'end-end',
          'end-decision',
          'leave-end2',
          'leave-terminate',
          'leave-end',
          'leave-decision'
        ]);
        done();
      });
    });
  });
});
