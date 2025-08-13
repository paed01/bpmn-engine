import * as ck from 'chronokinesis';
import * as testHelpers from '../helpers/testHelpers.js';
import * as factory from '../helpers/factory.js';
import { Engine } from '../../src/index.js';
import { camundaBpmnModdle as camunda } from '../helpers/testHelpers.js';

const timersSource = factory.resource('timers.bpmn');

Feature('Timers', () => {
  after(ck.reset);

  Scenario('a flow with different timers', () => {
    const catchDate = new Date('1993-06-25');
    before(() => {
      ck.travel(catchDate);
    });
    after(ck.reset);

    let engine;
    Given('a time cycle start event, bound time duration event, throw time date event, and a user task with due date', async () => {
      const sourceContext = await testHelpers.context(timersSource, {
        camunda,
      });

      engine = Engine({
        name: 'timers',
        sourceContext,
        variables: {
          catchDate: '1993-06-26',
          dueDate: '1993-06-27',
        },
        extensions: {
          timers(activity) {
            if (!activity.behaviour.dueDate) return;

            activity.on('activity.enter', (api) => {
              activity.broker.publish('format', 'run.user.duedate', {
                dueDate: new Date(api.resolveExpression(activity.behaviour.dueDate)),
              });
            });
          },
        },
      });
    });

    let end, execution;
    When('engine is ran', async () => {
      end = engine.waitFor('end');
      execution = await engine.execute();
    });

    let activity;
    Then('the start event is waiting', () => {
      [activity] = execution.getPostponed();
      expect(activity).to.have.property('id', 'start-cycle');
    });

    And('time cycle is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('timeCycle', 'R3/PT10H');
    });

    And('activity status is timer', () => {
      expect(engine.activityStatus).to.equal('timer');
    });

    When('start event times out', () => {
      execution.environment.timers.executing[0].callback();
    });

    let task;
    Then('bound time duration event is waiting', () => {
      [activity, task] = execution.getPostponed();
      expect(activity).to.have.property('id', 'bound-duration');
    });

    And('time duration is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('timeDuration', 'PT1M');
    });

    When('bound task is signaled', () => {
      execution.signal({ id: task.id });
    });

    Then('throw time date event is waiting', () => {
      [activity, task] = execution.getPostponed();
      expect(activity).to.have.property('id', 'catch-date');
    });

    And('time date is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content)
        .to.have.property('expireAt')
        .to.deep.equal(new Date(1993, 5, 26));
      expect(timer.content).to.have.property('timeDate').to.equal('1993-06-26');
    });

    When('throw event is cancelled', () => {
      execution.cancelActivity({ id: activity.id });
    });

    Then('user task with due date is waiting', () => {
      [activity] = execution.getPostponed();
      expect(activity).to.have.property('id', 'user-due');
    });

    And('due date is present', () => {
      expect(activity.content).to.have.property('dueDate').to.deep.equal(new Date('1993-06-27'));
    });

    When('user task is signaled', () => {
      execution.signal({ id: activity.id });
    });

    Then('execution completes', () => {
      return end;
    });

    Given('the flow is ran again', async () => {
      execution = await engine.execute();
    });

    let state;
    And('execution is stopped and state is saved', () => {
      execution.stop();
      state = execution.getState();
    });

    When('resumed', async () => {
      execution = await engine.resume();
    });

    Then('the start event is waiting', () => {
      [activity] = execution.getPostponed();
      expect(activity).to.have.property('id', 'start-cycle');
    });

    And('time cycle is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('timeCycle', 'R3/PT10H');
    });

    Given('the execution is recovered and resumed somewhere else', async () => {
      engine.stop();

      engine = Engine();
      engine.recover(JSON.parse(JSON.stringify(state)));
      execution = await engine.resume();
    });

    Then('the start event is waiting', () => {
      [activity] = execution.getPostponed();
      expect(activity).to.have.property('id', 'start-cycle');
    });

    And('time cycle is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('timeCycle', 'R3/PT10H');
    });

    Given('start event times out', () => {
      execution.environment.timers.executing[0].callback();
    });

    And('execution is stopped and state is saved', () => {
      execution.stop();
      state = execution.getState();
    });

    When('the execution is recovered and resumed somewhere else', async () => {
      engine = Engine();
      engine.recover(JSON.parse(JSON.stringify(state)));
      execution = await engine.resume();
    });

    Then('bound time duration event is waiting', () => {
      [activity, task] = execution.getPostponed();
      expect(activity).to.have.property('id', 'bound-duration');
    });

    And('time duration is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('timeDuration', 'PT1M');
    });

    Given('execution is stopped and state is saved', () => {
      execution.stop();
      state = execution.getState();
    });

    When('the engine is recovered and resumed somewhere else', async () => {
      engine = Engine();
      engine.recover(JSON.parse(JSON.stringify(state)));
      execution = await engine.resume();
    });

    Then('bound time duration event is still waiting', () => {
      [activity, task] = execution.getPostponed();
      expect(activity).to.have.property('id', 'bound-duration');
    });

    And('time duration is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('timeDuration', 'PT1M');
    });

    Given('bound task is signaled', () => {
      execution.signal({ id: task.id });
    });

    And('execution is stopped and state is saved', () => {
      execution.stop();
      state = execution.getState();
    });

    And('time date is due', () => {
      ck.travel('1993-06-28');
    });

    let timeoutMessage;
    When('the engine is recovered and resumed somewhere else', async () => {
      engine = Engine();
      engine.recover(JSON.parse(JSON.stringify(state)));

      engine.broker.subscribeTmp(
        'event',
        'activity.timer',
        (_, msg) => {
          timeoutMessage = msg;
        },
        { noAck: true }
      );

      execution = await engine.resume();
    });

    Then('throw time date has timed out', () => {
      expect(timeoutMessage.content)
        .to.have.property('expireAt')
        .to.deep.equal(new Date(1993, 5, 26));
      expect(timeoutMessage.content).to.have.property('timeDate').to.equal('1993-06-26');
    });
  });

  Scenario('engine with added arbitrary timers', () => {
    let engine, source;
    Given('a source with user task and a bound timer event', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="bp2" isExecutable="true">
          <userTask id="task" />
          <boundaryEvent id="bound-timer-2" attachedToRef="task">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT30S</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
        </process>
      </definitions>
      `;

      engine = Engine({
        name: 'extra-timers',
        source,
      });
    });

    let execution;
    When('engine is ran', async () => {
      execution = await engine.execute();
    });

    let arbitraryTimers;
    And('an arbitrary timer is registered for some reason', () => {
      arbitraryTimers = engine.environment.timers.register({ extra: true });
      arbitraryTimers.setTimeout(() => {}, 1000 * 60 * 10);
    });

    Then('two timers are executing', () => {
      expect(engine.environment.timers.executing).to.have.length(2);
    });

    When('executing is stopped', () => {
      execution.stop();
    });

    Then('both timers are cleared', () => {
      expect(engine.environment.timers.executing).to.have.length(0);
    });

    When('run is resumed', () => {
      engine.resume();
    });

    Then('one timers is resumed', () => {
      expect(engine.environment.timers.executing).to.have.length(1);
    });

    And('an arbitrary timer is registered again', () => {
      arbitraryTimers.setTimeout(() => {}, 1000 * 60 * 10);
    });

    Then('two timers are executing', () => {
      expect(engine.environment.timers.executing).to.have.length(2);
    });

    let end;
    When('user task is signalled', () => {
      end = engine.waitFor('end');
      engine.execution.signal({ id: 'task' });
    });

    Then('run completes', () => {
      return end;
    });

    And('arbitrary timer is cleared', () => {
      expect(engine.environment.timers.executing).to.have.length(0);
    });

    When('engine is ran again', async () => {
      engine = Engine({
        name: 'extra-timers',
        source,
      });

      execution = await engine.execute();
    });

    And('an arbitrary timer is added', () => {
      arbitraryTimers = engine.environment.timers.register({ extra: true });
      arbitraryTimers.setTimeout(() => {}, 1000 * 60 * 10);
    });

    Then('two timers are executing', () => {
      expect(engine.environment.timers.executing).to.have.length(2);
    });

    let errored;
    When('user task is errored', () => {
      const [, userTask] = execution.getPostponed();
      expect(userTask.id).to.equal('task');

      errored = engine.waitFor('error');

      userTask.fail(new Error('Bad request'));
    });

    Then('run fails', async () => {
      const err = await errored;
      expect(err.type).to.equal('ActivityError');
    });

    And('arbitrary timer is cleared', () => {
      expect(engine.environment.timers.executing).to.have.length(0);
    });
  });

  Scenario('engine with invalid timers', () => {
    let engine, source;
    Given('a source with user task and a bound timer event with invalid date', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="bp2" isExecutable="true">
          <userTask id="task" />
          <boundaryEvent id="bound-timer-2" attachedToRef="task">
            <timerEventDefinition>
              <timeDate xsi:type="tFormalExpression">2023-01-32</timeDate>
            </timerEventDefinition>
          </boundaryEvent>
        </process>
      </definitions>
      `;

      engine = Engine({
        name: 'invalid-timers',
        source,
      });
    });

    let fail;
    When('source is executed', async () => {
      fail = engine.waitFor('error');
      await engine.execute();
    });

    Then('run fails', async () => {
      const err = await fail;
      expect(err).to.match(/Invalid ISO 8601 date/i);
    });

    Given('a source with a start event timer with invalid cycle', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="bp2" isExecutable="true">
          <startEvent id="bound-timer-2" attachedToRef="task">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">R-3/2023-01-32</timeCycle>
            </timerEventDefinition>
          </startEvent>
        </process>
      </definitions>
      `;

      engine = Engine({
        name: 'invalid-timers',
        source,
      });
    });

    When('source is executed', async () => {
      fail = engine.waitFor('error');
      await engine.execute();
    });

    Then('run fails', async () => {
      const err = await fail;
      expect(err).to.match(/Unexpected/i);
    });
  });
});
