'use strict';

const ck = require('chronokinesis');
const testHelpers = require('../helpers/testHelpers');
const factory = require('../helpers/factory');
const {Engine} = require('../../index');

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
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      });

      engine = Engine({
        name: 'timers',
        sourceContext,
        variables: {
          catchDate: '1993-06-26',
          dueDate: '1993-06-27'
        },
        extensions: {
          timers(activity) {
            if (!activity.behaviour.dueDate) return;

            activity.on('activity.enter', (api) => {
              activity.broker.publish('format', 'run.user.duedate', {
                dueDate: new Date(api.resolveExpression(activity.behaviour.dueDate)),
              });
            });
          }
        }
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
      execution.signal({id: task.id});
    });

    Then('throw time date event is waiting', () => {
      [activity, task] = execution.getPostponed();
      expect(activity).to.have.property('id', 'catch-date');
    });

    And('time date is executing', () => {
      const [timer] = activity.getExecuting();
      expect(timer.content).to.have.property('expireAt').to.deep.equal(new Date('1993-06-26'));
      expect(timer.content).to.have.property('timeDate').to.equal('1993-06-26');
    });

    When('throw event is canceled', () => {
      execution.cancelActivity({id: activity.id});
    });

    Then('user task with due date is waiting', () => {
      [activity] = execution.getPostponed();
      expect(activity).to.have.property('id', 'user-due');
    });

    And('due date is present', () => {
      expect(activity.content).to.have.property('dueDate').to.deep.equal(new Date('1993-06-27'));
    });

    When('user task is signaled', () => {
      execution.signal({id: activity.id});
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
      execution.signal({id: task.id});
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

      engine.broker.subscribeTmp('event', 'activity.timer', (_, msg) => {
        timeoutMessage = msg;
      }, {noAck: true});

      execution = await engine.resume();
    });

    Then('throw time date has timed out', () => {
      expect(timeoutMessage.content).to.have.property('expireAt').to.deep.equal(new Date('1993-06-26'));
      expect(timeoutMessage.content).to.have.property('timeDate').to.equal('1993-06-26');
    });
  });
});
