import { Engine } from '../../../src/index.js';
import * as factory from '../../helpers/factory.js';
import { camundaBpmnModdle as camunda } from '../../helpers/testHelpers.js';

const source = factory.resource('issue-187.bpmn');

Feature('issue 187 - Complete condition in multi-instance loop with custom expression parser', () => {
  Scenario('user task is looped over list of handlers', () => {
    let engine;
    Given('start event, intermediate throw event, and end event', () => {
      engine = getEngine187();
    });

    let end;
    When('executed', () => {
      end = engine.waitFor('end');
      return engine.execute();
    });

    And('first manual task is signaled', () => {
      engine.execution.signal({ id: engine.execution.getPostponed()[0].id });
    });

    And('first user task is signaled', () => {
      engine.execution.signal({ id: engine.execution.getPostponed()[0].id });
    });

    let loopedTask;
    Then('looped user task is waiting', () => {
      loopedTask = engine.execution.getPostponed().find((api) => api.content.isMultiInstance);
      expect(loopedTask).to.be.ok;
    });

    When('first handler signals with pass', () => {
      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, pass: true });
    });

    Then('first handler iterated user task is waiting', () => {
      loopedTask = engine.execution.getPostponed().find((api) => api.content.isMultiInstance);
      expect(loopedTask).to.be.ok;
    });

    When('second and third handler signals with pass', () => {
      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, pass: true });
      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, pass: true });
    });

    let task;
    Then('a modify manual task is waiting', () => {
      task = engine.execution.getPostponed().pop();
      expect(task).to.be.ok;
    });

    When('manual task is signalled', () => {
      engine.execution.signal({ id: task.id });
    });

    Then('execution loops back to first user task', () => {
      task = engine.execution.getPostponed().pop();
      expect(task).to.be.ok;
    });

    When('first user task is signalled again', () => {
      engine.execution.signal({ id: task.id });
    });

    Then('withdrawal task is waiting', () => {
      task = engine.execution.getPostponed().find(({ id }) => id === 'task_with_draw');
      expect(task).to.be.ok;
    });

    When('withdrawal task is signalled', () => {
      engine.execution.signal({ id: task.id });
    });

    Then('handler loop is cancelled', () => {
      expect(engine.execution.getPostponed().find((api) => api.content.isMultiInstance)).to.not.be.ok;
    });

    And('modify manual task is waiting again', () => {
      task = engine.execution.getPostponed().pop();
      expect(task.type).to.equal('bpmn:ManualTask');
    });

    When('manual task is signalled', () => {
      engine.execution.signal({ id: task.id });
    });

    Then('execution loops back to first user task', () => {
      task = engine.execution.getPostponed().pop();
      expect(task).to.be.ok;
    });

    When('first user task is signalled again', () => {
      engine.execution.signal({ id: task.id });
    });

    Then('first handler iterated user task is waiting again', () => {
      loopedTask = engine.execution.getPostponed().find((api) => api.content.isMultiInstance);
      expect(loopedTask).to.be.ok;
    });

    When('first handler decides to break', () => {
      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, break: true });
    });

    Then('run completes', () => {
      return end;
    });

    When('running again', () => {
      engine = getEngine187();
      end = engine.waitFor('end');
      return engine.execute();
    });

    And('first manual and user tasks are signaled', () => {
      engine.execution.signal({ id: engine.execution.getPostponed()[0].id });
      engine.execution.signal({ id: engine.execution.getPostponed()[0].id });
    });

    When('all handlers signals with with reject', () => {
      loopedTask = engine.execution.getPostponed().find((api) => api.content.isMultiInstance);

      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, pass: false });
      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, pass: false });
      engine.execution.signal({ executionId: loopedTask.getExecuting().pop().executionId, pass: false });
    });

    Then('run completes', () => {
      return end;
    });
  });
});

function getEngine187() {
  const values = {};
  return new Engine({
    name: 'issue-187',
    moddleOptions: {
      camunda,
    },
    source,
    variables: {
      values,
      handlers: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
    services: {
      set_value: function setValue(key, value) {
        values[key] = value;
      },
      get_value(key) {
        return values[key];
      },
      get_handlers() {
        return Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }]);
      },
      gen_remind_task() {},
    },
    extensions: {
      inputOutputExtension,
    },
  });
}

function inputOutputExtension(element) {
  if (element.type === 'bpmn:Process') return;

  let io;
  const resultVariable = element.behaviour.resultVariable;
  if (element.behaviour.extensionElements?.values) {
    const extendValues = element.behaviour.extensionElements.values;
    io = extendValues.reduce((result, extension) => {
      if (extension.$type === 'camunda:InputOutput') {
        result.input = extension.inputParameters;
        result.output = extension.outputParameters;
      }
      return result;
    }, {});
  }

  return {
    activate() {
      if (io) element.on('enter', onEnter, { consumerTag: 'format_on_enter' });
      element.on('end', onEnd, { consumerTag: 'format_on_end' });
    },
    deactivate() {
      element.broker.cancel('format_on_enter');
      element.broker.cancel('format_on_end');
    },
  };

  function onEnter(elementApi) {
    const input = io?.input?.reduce((result, { name, value }) => {
      result[name] = elementApi.resolveExpression(value);
      return result;
    }, {});

    element.broker.publish('format', 'run.io', { input });
  }

  function onEnd(elementApi) {
    if ('output' in elementApi.content) {
      elementApi.environment.output[resultVariable || elementApi.id] = elementApi.content.output;
    }
  }
}
