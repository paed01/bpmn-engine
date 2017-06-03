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
          'end-start',
          'taken-flow1',
          'enter-fork',
          'start-fork',
          'leave-start',
          'end-fork',
          'taken-flow2',
          'enter-join',
          'start-join',
          'taken-flow3',
          'start-join',
          'end-join',
          'leave-fork',
          'taken-flow4',
          'enter-end',
          'start-end',
          'leave-join',
          'end-end',
          'leave-end']);
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
          'end-start',
          'taken-flow1',
          'enter-decision',
          'start-decision',
          'end-decision',
          'leave-start',
          'taken-flow3',
          'enter-join',
          'start-join',
          'discarded-flow2',
          'end-join',
          'leave-decision',
          'taken-flow4',
          'enter-end',
          'start-end',
          'leave-join',
          'end-end',
          'leave-end'
        ]);
        done();
      });
    });
  });

  lab.test('emits expected event sequence for a discarded parallel gateway', (done) => {
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
          'end-start',
          'taken-flow1',
          'enter-decision',
          'start-decision',
          'end-decision',
          'leave-start',
          'taken-flow4',
          'enter-end',
          'start-end',
          'discarded-flow2',
          'enter-join',
          'discarded-flow3',
          'leave-decision',
          'end-end',
          'discarded-flow5',
          'enter-terminate',
          'leave-join',
          'leave-end',
          'leave-terminate'
        ]);
        done();
      });
    });
  });
});
