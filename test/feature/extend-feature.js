'use strict';

const {Engine} = require('../..');

Feature('extending behaviour', () => {
  Scenario('Activity extension', () => {
    let engine, source;
    Given('a bpmn source with user tasks', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <userTask id="task1" camunda:formKey="taskForm" />
          <sequenceFlow id="flow" sourceRef="task1" targetRef="task2" />
          <userTask id="task2" />
        </process>
      </definitions>`;
    });

    And('an engine loaded with extension for fetching form and saving output', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        },
        extensions: {
          fetchForm(activity) {
            if (!activity.behaviour.formKey) return;

            const endRoutingKey = 'run.form.end';

            activity.on('enter', () => {
              activity.broker.publish('format', 'run.form.start', {endRoutingKey});

              getForm(activity).then((form) => {
                activity.broker.publish('format', endRoutingKey, {form});
              });
            });
          },
          saveToEnvironmentOutput(activity, {environment}) {
            activity.on('end', (api) => {
              environment.output[api.id] = api.content.output;
            });
          }
        }
      });

      function getForm(activity) {
        return new Promise((resolve) => {
          return resolve({
            id: activity.behaviour.formKey,
            fields: {
              surname: ''
            },
          });
        });
      }
    });

    let api;
    When('source is executed', async () => {
      api = await engine.execute();
    });

    Then('engine has postponed activities', () => {
      expect(api.getPostponed()).to.have.length(1);
    });

    let task;
    And('the first is a user task with form input fields', () => {
      [task] = api.getPostponed();
      expect(task).to.have.property('id', 'task1');
      expect(task).to.have.property('type', 'bpmn:UserTask');
      expect(task.content).to.have.property('form').with.property('id', 'taskForm');
    });

    When('task is signaled', () => {
      task.signal({
        surname: 'von Rosen'
      });
    });

    Then('the run stops at next user task without form', () => {
      [task] = api.getPostponed();
      expect(task).to.have.property('id', 'task2');
      expect(task).to.have.property('type', 'bpmn:UserTask');
      expect(task.content).to.not.have.property('form');
    });

    When('task is signaled', () => {
      task.signal(2);
    });

    Then('engine comletes run', () => {
      expect(api.state).to.equal('idle');
    });

    And('extension have saved output in environment', () => {
      expect(engine.environment.output).to.have.property('task1').that.eql({surname: 'von Rosen'});
      expect(engine.environment.output).to.have.property('task2', 2);
    });
  });
});
