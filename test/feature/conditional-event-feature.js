import { Engine } from 'bpmn-engine';
import * as factory from '../helpers/factory.js';

const boundJsEventSource = factory.resource('conditional-bound-js-event.bpmn');

Feature('Conditional event', () => {
  Scenario('A service with conditional bound expression event', () => {
    let source, engine, serviceCallback;
    Given('a source matching scenario', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" />
          <serviceTask id="service" implementation="\${environment.services.test}" />
          <boundaryEvent id="conditionalEvent" attachedToRef="service" cancelActivity="true">
            <conditionalEventDefinition>
              <condition xsi:type="tFormalExpression">\${environment.services.conditionMet(content, properties.type)}</condition>
            </conditionalEventDefinition>
          </boundaryEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow0" sourceRef="start" targetRef="service" />
          <sequenceFlow id="flow1" sourceRef="service" targetRef="end" />
          <sequenceFlow id="flow2" sourceRef="conditionalEvent" targetRef="end" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Conditional event feature',
        source,
        services: {
          test(...args) {
            serviceCallback = args.pop();
          },
        },
      });
    });

    And('a condition evaluation function', () => {
      engine.environment.addService('conditionMet', function conditionMet(_messageContent, type) {
        if (type !== 'signal') return false;
        return true;
      });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      return engine.execute();
    });

    And('service completes', () => {
      serviceCallback();
    });

    Then('run completes', () => {
      return end;
    });

    And('bound condition was discarded', () => {
      expect(engine.execution.getActivityById('conditionalEvent').counters).to.deep.equal({ taken: 0, discarded: 1 });
    });

    let wait;
    When('ran again', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });

      return engine.execute();
    });

    Then('bound condition is waiting', async () => {
      const event = await wait;
      expect(event.content).to.have.property('condition', 'expression');
    });

    When('condition is signalled', () => {
      engine.execution.signal({ id: 'conditionalEvent' });
    });

    Then('run completes', () => {
      return end;
    });

    And('bound condition was taken', () => {
      expect(engine.execution.getActivityById('conditionalEvent').counters).to.deep.equal({ taken: 1, discarded: 0 });
    });

    Given('both condition and service completes immediately', () => {
      engine = new Engine({
        name: 'Conditional event feature',
        source,
        services: {
          conditionMet() {
            return true;
          },
          test(...args) {
            args.pop()();
          },
        },
      });
    });

    When('run with same source', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('condition takes precedence', async () => {
      await end;
      expect(engine.execution.getActivityById('service').counters).to.deep.equal({ taken: 0, discarded: 1 });
    });

    let errored;
    When('ran again with a bad condition evaluation function', () => {
      engine = new Engine({
        name: 'Conditional event feature',
        source,
        services: {
          conditionMet(_content, type) {
            if (type !== 'signal') return false;
            throw new Error('Expected');
          },
          test(...args) {
            serviceCallback = args.pop();
          },
        },
      });

      errored = engine.waitFor('error');
      return engine.execute();
    });

    And('condition is signalled', () => {
      engine.execution.signal({ id: 'conditionalEvent' });
    });

    Then('run fails', async () => {
      const err = await errored;
      expect(err).to.have.property('source').with.property('content').with.property('id', 'conditionalEvent');
    });

    And('bound condition was discarded', () => {
      expect(engine.execution.getActivityById('conditionalEvent').counters).to.deep.equal({ taken: 0, discarded: 1 });
    });
  });

  Scenario('With bound javascript condition', () => {
    let engine;
    Given('a process matching scenario', () => {
      engine = new Engine({
        name: 'Conditional event feature',
        source: boundJsEventSource,
      });
    });

    let wait, completed;
    When('ran', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });
      completed = engine.waitFor('end');
      engine.execute();
    });

    And('conditional bound event is signalled', async () => {
      await wait;
      engine.execution.signal({ id: 'cond' });
    });

    Then('run completes', async () => {
      await completed;
    });

    And('bound condition was taken', () => {
      expect(engine.execution.getActivityById('cond').counters).to.deep.equal({ taken: 1, discarded: 0 });
    });

    When('ran again', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });
      completed = engine.waitFor('end');
      engine.execute();
    });

    And('task with attached condition is signalled', async () => {
      await wait;
      engine.execution.signal({ id: 'task' });
    });

    Then('run completes', async () => {
      await completed;
    });

    And('bound condition was discared', () => {
      expect(engine.execution.getActivityById('cond').counters).to.deep.equal({ taken: 0, discarded: 1 });
    });

    Given('ran once again', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });
      engine.execute();
    });

    let state;
    And('stopped while waiting for condition', async () => {
      await wait;
      engine.stop();
      state = await engine.getState();
    });

    When('stopped run is resumed', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });
      completed = engine.waitFor('end');
      engine.resume();
    });

    Then('condition is waiting again', async () => {
      await wait;
    });

    When('task with attached condition is signalled', () => {
      engine.execution.signal({ id: 'cond' });
    });

    Then('resumed run completes', async () => {
      await completed;
    });

    When('stopped state is used to recover and resume run', () => {
      engine = new Engine().recover(state);

      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });
      completed = engine.waitFor('end');

      engine.resume();
    });

    Then('condition is waiting again', async () => {
      await wait;
    });

    And('task with attached condition is signalled', async () => {
      await wait;
      engine.execution.signal({ id: 'cond' });
    });

    Then('recovered run completes', async () => {
      await completed;
    });
  });

  Scenario('condition script is slow', () => {
    let source, engine;
    Given('a process with bound javascript condition', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="service" implementation="\${environment.services.test}" />
          <boundaryEvent id="cond" attachedToRef="service" cancelActivity="true">
            <conditionalEventDefinition>
              <condition xsi:type="tFormalExpression" language="js">
                environment.services.conditionMet(properties.type, next);
              </condition>
            </conditionalEventDefinition>
          </boundaryEvent>
        </process>
      </definitions>`;

      engine = new Engine({ name: 'slow condition', source });
    });

    And('service function completes immediately', () => {
      engine.environment.addService('test', (...args) => args.pop()());
    });

    let nextFunction;
    And('a slow condition function', () => {
      engine.environment.addService('conditionMet', (_type, next) => {
        nextFunction = next;
      });
    });

    let end;
    When('run', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('run completes since service completed', () => {
      return end;
    });

    When('condition completes', () => {
      nextFunction(null, true);
    });
  });

  Scenario('recover resume', () => {
    let source, engine;
    Given('a process with bound javascript condition', () => {
      source = `
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <process id="theProcess" isExecutable="true">
            <startEvent id="start" />
            <manualTask id="task" />
            <boundaryEvent id="cond" attachedToRef="task" cancelActivity="true">
              <conditionalEventDefinition>
                <condition xsi:type="tFormalExpression" language="js">
                  next(null, properties.type === 'signal' && content.message.type === "create");
                </condition>
              </conditionalEventDefinition>
            </boundaryEvent>
            <endEvent id="end" />
            <sequenceFlow id="flow0" sourceRef="start" targetRef="task" />
            <sequenceFlow id="flow1" sourceRef="task" targetRef="end" />
            <sequenceFlow id="flow2" sourceRef="cond" targetRef="end" />
          </process>
        </definitions>`;

      engine = new Engine({ name: 'Recover resume', source });
    });

    let state, stopped;
    When('run and saving state on activity condition', () => {
      engine.broker.subscribeOnce('event', 'activity.condition', async () => {
        state = await engine.getState();
        engine.stop();
      });

      stopped = engine.waitFor('stop');

      engine.execute();
    });

    Then('state is saved', async () => {
      await stopped;
    });

    When('recovered and resumed', () => {
      engine = new Engine().recover(state);
      engine.resume();

      engine.broker.subscribeOnce('event', 'activity.condition', async () => {
        state = await engine.getState();
        engine.stop();
      });

      stopped = engine.waitFor('stop');
    });

    And('condition is signalled with non-matching message', () => {
      engine.execution.signal({ id: 'cond' });
    });

    Then('run is stopped', () => {
      return stopped;
    });

    let completed;
    When('recovered and resumed from signal', () => {
      engine = new Engine().recover(state);
      engine.resume();

      completed = engine.waitFor('end');
    });

    And('condition is signalled with matching message', () => {
      engine.execution.signal({ id: 'cond', type: 'create' });
    });

    Then('run completes', () => {
      return completed;
    });

    When('recovered and resumed from signal state again', () => {
      engine = new Engine().recover(state);
      engine.resume();

      stopped = engine.waitFor('stop');
    });

    And('condition is signalled with non-matching message and stopped on activity.condition', () => {
      engine.execution.getActivityById('cond').broker.subscribeOnce('event', 'activity.condition', () => {
        engine.stop();
      });

      engine.execution.signal({ id: 'cond' });
    });

    Then('run is stopped', () => {
      return stopped;
    });

    When('run is resumed', () => {
      engine.resume();
      completed = engine.waitFor('end');
    });

    And('condition is signalled with matching message', () => {
      engine.execution.signal({ id: 'cond', type: 'create' });
    });

    Then('resumed run completes', () => {
      return completed;
    });

    When('recovered and resumed from signal state yet again', () => {
      engine = new Engine().recover(state);
      engine.resume();

      completed = engine.waitFor('end');
    });

    And('attached task completes', () => {
      engine.execution.signal({ id: 'task' });
    });

    Then('resumed run completes', () => {
      return completed;
    });
  });

  Scenario('signalling', () => {
    let source, engine;
    Given('a process matching scenario', () => {
      source = `
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <process id="theProcess" isExecutable="true">
            <startEvent id="start" />
            <manualTask id="task" />
            <boundaryEvent id="cond" attachedToRef="task" cancelActivity="true">
              <conditionalEventDefinition>
                <condition xsi:type="tFormalExpression" language="js">
                  next(null, properties.type === 'signal' && content.message.type === "create");
                </condition>
              </conditionalEventDefinition>
            </boundaryEvent>
            <endEvent id="end" />
            <sequenceFlow id="flow0" sourceRef="start" targetRef="task" />
            <sequenceFlow id="flow1" sourceRef="task" targetRef="end" />
            <sequenceFlow id="flow2" sourceRef="cond" targetRef="end" />
          </process>
        </definitions>`;

      engine = new Engine({ name: 'signalling', source });
    });

    let wait, completed;
    When('ran waiting for signal', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });

      completed = engine.waitFor('end');

      engine.execute();
    });

    And('signalled multiple times where one in the middle matches condition', async () => {
      await wait;

      for (let i = 0; i < 15; i++) {
        engine.execution.signal({ id: 'cond', type: i === 8 ? 'create' : 'ignore' });
      }
    });

    Then('run completes', () => {
      return completed;
    });
  });

  Scenario('With bound bad javascript condition', () => {
    let source, engine, serviceCallback;
    Given('a process matching scenario', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" />
          <serviceTask id="service" implementation="\${environment.services.test}" />
          <boundaryEvent id="cond" attachedToRef="service" cancelActivity="true">
            <conditionalEventDefinition>
              <condition xsi:type="tFormalExpression" language="js">next(null, properties.type === 'signal' && content.foo.bar);</condition>
            </conditionalEventDefinition>
          </boundaryEvent>
          <endEvent id="end" />
          <sequenceFlow id="flow0" sourceRef="start" targetRef="service" />
          <sequenceFlow id="flow1" sourceRef="service" targetRef="end" />
          <sequenceFlow id="flow2" sourceRef="cond" targetRef="end" />
        </process>
      </definitions>`;

      engine = new Engine({
        name: 'Bad js',
        source,
        services: {
          test(...args) {
            serviceCallback = args.pop();
          },
        },
      });
    });

    let wait, errored;
    When('ran', () => {
      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });
      errored = engine.waitFor('error');
      engine.execute();
    });

    And('conditional bound event is signalled', async () => {
      await wait;
      engine.execution.signal({ id: 'cond' });
    });

    Then('run failed', async () => {
      await errored;
    });

    let completed;
    Given('ran again', () => {
      engine = new Engine({
        name: 'Bad js',
        source,
        services: {
          test(...args) {
            serviceCallback = args.pop();
          },
        },
      });

      wait = new Promise((resolve) => {
        engine.broker.subscribeOnce('event', 'activity.wait', (_, msg) => {
          resolve(msg);
        });
      });

      completed = engine.waitFor('end');
      engine.execute();
    });

    When('task completes', async () => {
      await wait;
      serviceCallback();
    });

    Then('run completes', () => {
      return completed;
    });
  });

  Scenario('A conditional start event', () => {
    let engine;
    let count = 0;
    Given('a process', () => {
      const source = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start">
            <conditionalEventDefinition>
              <condition xsi:type="tFormalExpression">\${environment.services.conditionMet()}</condition>
            </conditionalEventDefinition>
          </startEvent>
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      engine = new Engine({ name: 'conditional start event', source });
    });

    let completed;
    When('ran and condition is met', () => {
      engine.environment.addService('conditionMet', () => {
        return true;
      });

      completed = engine.waitFor('end');

      engine.execute();
    });

    Then('run completes', () => {
      return completed;
    });

    Given('a bad condition function', () => {
      engine.environment.addService('conditionMet', () => {
        if (count++ % 2) return false;
        throw new Error('Unexpected');
      });
    });

    let errored;
    When('ran again', () => {
      errored = engine.waitFor('error');
      engine.execute();
    });

    Then('run failed', async () => {
      const err = await errored;
      expect(err).to.have.property('source').with.property('content').with.property('id', 'start');
    });
  });
});
