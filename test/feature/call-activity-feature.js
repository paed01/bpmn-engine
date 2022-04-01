'use strict';

const factory = require('../helpers/factory');
const {Engine} = require('../..');

Feature('Call activity', () => {
  Scenario('call process in the same diagram', () => {
    let engine;
    Given('a process with a call activity referencing a process', async () => {
      const source = factory.resource('call-activity.bpmn');
      engine = new Engine({
        name: 'Call activity feature',
        source,
      });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('called process throws', () => {
    let engine;
    Given('a process with a call activity referencing a process that throws', async () => {
      const source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="main-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-call-activity" sourceRef="start" targetRef="call-activity" />
          <callActivity id="call-activity" calledElement="called-process" />
          <endEvent id="end" />
          <sequenceFlow id="to-end" sourceRef="call-activity" targetRef="end" />
        </process>
        <process id="called-process" isExecutable="false">
          <serviceTask id="task" implementation="\${environment.services.serviceFn}" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Call activity feature',
        source,
        services: {
          serviceFn(...args) {
            args.pop()(new Error('No cigarr'));
          },
        },
      });
    });

    let endInError;
    When('ran', () => {
      endInError = engine.waitFor('error');
      engine.execute();
    });

    Then('run fails', () => {
      return endInError;
    });

    Given('a process with a call activity with bound error handling referencing a process that throws', async () => {
      const source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="main-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-call-activity" sourceRef="start" targetRef="call-activity" />
          <callActivity id="call-activity" calledElement="called-process" />
          <boundaryEvent id="bound" attachedToRef="call-activity">
            <errorEventDefinition />
          </boundaryEvent>
          <sequenceFlow id="to-end" sourceRef="call-activity" targetRef="end" />
          <endEvent id="end" />
          <sequenceFlow id="to-failend" sourceRef="bound" targetRef="failedend" />
          <endEvent id="failedend" />
        </process>
        <process id="called-process" isExecutable="false">
          <serviceTask id="task" implementation="\${environment.services.serviceFn}" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Call activity feature',
        source,
        services: {
          serviceFn(...args) {
            args.pop()(new Error('No cigarr'));
          },
        },
      });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('run completes', () => {
      return end;
    });

    And('error was caught by boundaryEvent', () => {});
  });

  Scenario('call activity is canceled', () => {
    let engine;
    Given('a process with a call activity referencing a process', async () => {
      const source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="main-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-call-activity" sourceRef="start" targetRef="call-activity" />
          <callActivity id="call-activity" calledElement="called-process" />
          <endEvent id="end" />
          <sequenceFlow id="to-end" sourceRef="call-activity" targetRef="end" />
        </process>
        <process id="called-process" isExecutable="false">
          <userTask id="task" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Call activity feature',
        source,
      });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('call activity has started process', () => {
      expect(engine.execution.definitions[0].getRunningProcesses()).to.have.length(2);
    });

    When('call activity is cancelled', () => {
      const [callActivity] = engine.execution.getPostponed();
      callActivity.cancel();
    });

    Then('run completes', () => {
      return end;
    });

    When('ran again', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('call activity has started process', () => {
      expect(engine.execution.definitions[0].getRunningProcesses()).to.have.length(2);
    });

    When('called process is discarded', () => {
      engine.execution.definitions[0].getRunningProcesses()[1].getApi().discard();
    });

    Then('run completes', () => {
      return end;
    });

    Given('a process with a call activity not referencing any process', async () => {
      const source = `
      <definitions id="Def_2" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="main-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-call-activity" sourceRef="start" targetRef="no-call-activity" />
          <callActivity id="no-call-activity" />
          <sequenceFlow id="to-end" sourceRef="no-call-activity" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Call activity feature',
        source,
      });
    });

    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    And('call activity is cancelled', () => {
      const callActivity = engine.execution.getPostponed()[0];
      expect(callActivity.id).to.equal('no-call-activity');
      callActivity.cancel();
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('call activity is discarded mid run', () => {
    let engine;
    Given('a process with a call activity referencing a process', async () => {
      const source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="main-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-call-activity" sourceRef="start" targetRef="call-activity" />
          <callActivity id="call-activity" calledElement="called-process" />
          <endEvent id="end" />
          <sequenceFlow id="to-end" sourceRef="call-activity" targetRef="end" />
        </process>
        <process id="called-process" isExecutable="false">
          <userTask id="task" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Call activity feature',
        source,
      });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('call activity has started process', () => {
      expect(engine.execution.definitions[0].getRunningProcesses()).to.have.length(2);
    });

    When('call activity is discarded', () => {
      const callActivity = engine.execution.getPostponed()[0];
      callActivity.discard();
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('a process with a parallel multi-instance call activity with cardinality of three', () => {
    let engine;
    const serviceCalls = [];
    Given('two processes', async () => {
      const source = `
      <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="main-process" isExecutable="true">
          <startEvent id="start" />
          <callActivity id="call-activity" calledElement="called-process">
            <multiInstanceLoopCharacteristics isSequential="false">
              <loopCardinality>3</loopCardinality>
            </multiInstanceLoopCharacteristics>
          </callActivity>
          <endEvent id="end" />
          <sequenceFlow id="to-end" sourceRef="call-activity" targetRef="end" />
          <sequenceFlow id="to-call-activity" sourceRef="start" targetRef="call-activity" />
        </process>
        <process id="called-process" isExecutable="false">
          <serviceTask id="task" implementation="\${environment.services.serviceFn}" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Call activity feature',
        source,
        services: {
          serviceFn(...args) {
            serviceCalls.push(args);
          },
        },
      });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('multi-instance is waiting to complete', () => {
      expect(serviceCalls).to.have.length(3);
    });

    And('executable process is running', () => {
      expect(engine.execution.definitions[0].getProcesses().filter(({id}) => id === 'main-process')).to.have.length(1);
    });

    And('three instances of called process are running with unique execution ids', () => {
      const called = engine.execution.definitions[0].getProcesses().filter(({id}) => id === 'called-process');
      expect(called).to.have.length(3);

      called.map(({executionId}) => executionId).forEach((bpExecId) => {
        expect(called.filter(({executionId}) => executionId === bpExecId), bpExecId + ' reused').to.have.length(1);
      });
    });

    When('multi-instance completes', () => {
      serviceCalls.forEach((args, idx) => args.pop()(null, idx + 1));
    });

    Then('run completes', () => {
      return end;
    });

    When('ran again', () => {
      serviceCalls.splice(0);
      engine.execute();
    });

    Then('multi-instance is waiting to complete', () => {
      expect(serviceCalls).to.have.length(3);
    });

    let state;
    Given('stopped', async () => {
      engine.stop();
      state = await engine.getState();
      serviceCalls.splice(0);
    });

    When('resumed', () => {
      end = engine.waitFor('end');
      engine.resume();
    });

    Then('multi-instance is waiting to complete', () => {
      expect(serviceCalls).to.have.length(3);
    });

    When('multi-instance completes', () => {
      serviceCalls.forEach((args, idx) => args.pop()(null, idx + 10));
    });

    Then('run completes', () => {
      return end;
    });

    Given('recovered from stopped', () => {
      engine = new Engine({
        services: {
          serviceFn(...args) {
            serviceCalls.push(args);
          },
        },
      }).recover(state);
    });

    When('resumed', () => {
      serviceCalls.splice(0);
      end = engine.waitFor('end');
      engine.resume();
    });

    Then('multi-instance is waiting to complete', () => {
      expect(serviceCalls).to.have.length(3);
    });

    When('multi-instance completes', () => {
      serviceCalls.forEach((args, idx) => args.pop()(null, idx + 20));
    });

    Then('run completes', () => {
      return end;
    });
  });
});
