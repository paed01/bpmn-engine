'use strict';

const factory = require('../helpers/factory');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../..');

const signalsSource = factory.resource('signals.bpmn');
const sendSignalSource = factory.resource('send-signal.bpmn');

Feature('Api', () => {
  Scenario('Two definitions that communicates with signals', () => {
    let engine, signalContext, updateContext;
    Given('a trade process waiting for spot price update signal and another admin processs that updates price', async () => {
      signalContext = await testHelpers.context(signalsSource, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      });
      engine = getExtendedEngine(signalContext);

      expect(await engine.getDefinitions()).to.have.length(1);
    });

    And('a second definition that updates spot price', async () => {
      updateContext = await testHelpers.context(sendSignalSource, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      });

      engine.addSource({
        sourceContext: updateContext,
      });

      expect(await engine.getDefinitions()).to.have.length(2);
    });

    let end, execution;
    When('engine is executed', async () => {
      end = engine.waitFor('end');
      execution = await engine.execute({
        variables: {
          spotPrice: 100
        },
      });
    });

    let tradeTask, spotPriceChanged;
    Then('trader is considering to trade', async () => {
      [spotPriceChanged, tradeTask] = execution.getPostponed();
      expect(tradeTask).to.be.ok;
      expect(tradeTask.content.form.fields.price.defaultValue).to.equal(100);
    });

    And('spot price is monitored by process', async () => {
      expect(spotPriceChanged).to.be.ok;
    });

    When('spot price is updated', async () => {
      const [, updateDefinition] = execution.definitions;
      const [updateProcess] = updateDefinition.getProcesses();

      updateDefinition.on('activity.wait', () => {
        execution.signal({
          id: 'set-spot-price',
          form: {
            newPrice: 110,
          }
        });
      });

      updateDefinition.run({processId: updateProcess.id});
    });

    Then('admin is notified that spot price has been updated', () => {
      const [, , adminApprove] = execution.getPostponed();
      expect(adminApprove).to.have.property('id', 'approveSpotPrice');
      expect(adminApprove.content).to.have.property('form').with.property('fields').with.property('newPrice').with.property('defaultValue', 110);
    });

    When('admin approves new spot price', () => {
      execution.signal({
        id: 'approveSpotPrice',
        form: {
          newPrice: 110
        }
      });
    });

    Then('trade task is discarded', async () => {
      [tradeTask, spotPriceChanged] = execution.getPostponed();
      expect(tradeTask.owner.counters).to.have.property('discarded', 1);
    });

    And('for coverage reasons the activity can be retrieved by getActivityById', () => {
      expect(execution.getActivityById(tradeTask.id).counters).to.have.property('discarded', 1);
    });

    And('update price is taken', async () => {
      expect(spotPriceChanged.owner.counters).to.have.property('taken', 1);
    });

    And('trader is presented new price', () => {
      expect(tradeTask.content.form.fields.price.defaultValue).to.equal(110);
    });

    When('trader trades', () => {
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 42,
        },
      });
    });

    And('trade task is taken', () => {
      expect(tradeTask.owner.counters).to.have.property('taken', 1);
      expect(tradeTask.owner.counters).to.have.property('discarded', 1);
    });

    And('run is completed', async () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters).to.have.property('completed', 1);
      expect(tradeDef.counters).to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters).to.have.property('completed', 1);
      expect(updateDef.counters).to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new spot price', async () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 42,
        price: 110,
        spotPrice: 110,
      });
    });

    Given('definition is ran again', async () => {
      end = engine.waitFor('end');
      execution = await engine.execute({
        variables: {
          spotPrice: 110,
        },
      });
    });

    When('trader trades again', async () => {
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 42,
        }
      });
    });

    Then('run completes', async () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters).to.have.property('completed', 1);
      expect(tradeDef.counters).to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters).to.have.property('completed', 0);
      expect(updateDef.counters).to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new spot price', async () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 42,
        price: 110,
        spotPrice: 110,
      });
    });

    Given('definition is ran again', async () => {
      end = engine.waitFor('end');
      execution = await engine.execute({
        variables: {
          spotPrice: 120,
        },
      });
    });

    And('spot price is on the verge to be updated', async () => {
      const [, updateDefinition] = execution.definitions;
      const [updateProcess] = updateDefinition.getProcesses();

      updateDefinition.run({processId: updateProcess.id});
    });

    let stopped, state;
    And('trade is paused', async () => {
      stopped = engine.waitFor('stop');
      execution.stop();
      state = execution.getState();
    });

    When('engine has stopped', async () => {
      await stopped;
      expect(execution.stopped).to.be.true;
      expect(engine.stopped).to.be.true;
    });

    Then('postponed activities are still accessible', () => {
      const postponed = execution.getPostponed();
      expect(postponed).to.have.length(3);
    });

    When('execution is resumed', async () => {
      engine = getExtendedEngine();
      engine.recover(state);
      end = engine.waitFor('end');
      execution = await engine.resume();
    });

    let setSpotPrice;
    Then('trader is ready to trade', () => {
      [, tradeTask, setSpotPrice] = execution.getPostponed();
      expect(tradeTask).to.have.property('id', 'tradeTask');
    });

    And('spot price is ready to be updated', () => {
      expect(setSpotPrice).to.have.property('id', 'set-spot-price');
    });

    Given('spot price is updated', () => {
      setSpotPrice.signal({
        form: {
          newPrice: 100,
        }
      });
    });

    And('trade is paused', async () => {
      execution.stop();
      state = execution.getState();
    });

    When('execution is resumed', async () => {
      engine = getExtendedEngine();
      engine.recover(state);
      end = engine.waitFor('end');
      execution = await engine.resume();
    });

    let approveSpotPrice;
    Then('trader is ready to trade', () => {
      [, tradeTask, approveSpotPrice] = execution.getPostponed();
      expect(tradeTask).to.have.property('id', 'tradeTask');
    });

    When('admin approves new spot price', () => {
      expect(approveSpotPrice).to.have.property('id', 'approveSpotPrice');
      expect(approveSpotPrice.content).to.have.property('form').with.property('fields').with.property('newPrice').with.property('defaultValue', 100);

      approveSpotPrice.signal({
        form: {
          newPrice: 100
        }
      });
    });

    When('trader resumes trade', async () => {
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 52,
        }
      });
    });

    Then('run completes', async () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('completed', 1);
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('completed', 1);
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new approved spot price', async () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 52,
        price: 100,
        spotPrice: 100,
      });
    });

    Given('the same engine is executed again', async () => {
      execution = await engine.execute();
    });

    And('state is saved when trader is trading', async () => {
      state = execution.getState();
    });

    When('execution is recovered and resumed', async () => {
      engine = getExtendedEngine();
      engine.recover(state);
      execution = await engine.resume();
    });

    And('spot price is updated', async () => {
      const [, updateDefinition] = execution.definitions;
      const [updateProcess] = updateDefinition.getProcesses();

      updateDefinition.on('activity.wait', () => {
        execution.signal({
          id: 'set-spot-price',
          form: {
            newPrice: 200,
          }
        });
      });

      updateDefinition.run({processId: updateProcess.id});
    });

    Then('admin approves new spot price', () => {
      execution.signal({
        id: 'approveSpotPrice',
        form: {
          newPrice: 200,
        }
      });
    });

    When('trader resumes trade', async () => {
      end = engine.waitFor('end');
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 52,
        }
      });
    });

    Then('run completes', async () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('completed', 1);
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('completed', 1);
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new approved spot price', async () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 52,
        price: 200,
        spotPrice: 200,
      });
    });
  });

  Scenario('Determine run sequences for an activity', () => {
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

    let definition;
    And('an engine loaded with extension for fetching form and saving output', async () => {
      engine = Engine({
        name: 'Shake feature',
        sourceContext: await testHelpers.context(source),
      });

      [definition] = await engine.getDefinitions();
    });

    let result;
    When('start task is shaken', () => {
      result = definition.shake('task1');
    });

    Then('run sequences are determined', () => {
      expect(result).to.have.property('task1').with.length(1);
      expect(result.task1[0]).to.have.property('sequence').with.length(3);
    });
  });
});

function getExtendedEngine(...sourceContexts) {
  const engine = Engine({
    name: 'Signal feature',
    sourceContext: sourceContexts.shift(),
    services: {
      getSpotPrice(context, callback) {
        const price = this.environment.variables.spotPrice;
        return callback(null, price);
      }
    },
    extensions: {
      camunda(activity, context) {
        if (activity.behaviour.extensionElements) {
          for (const extension of activity.behaviour.extensionElements.values) {
            switch (extension.$type) {
              case 'camunda:FormData':
                formFormatting(activity, context, extension);
                break;
              case 'camunda:InputOutput':
                ioFormatting(activity, context, extension);
                break;
            }
          }
        }
        if (activity.behaviour.expression) {
          activity.behaviour.Service = ServiceExpression;
        }
        if (activity.isStart && activity.eventDefinitions && activity.eventDefinitions.find(({type}) => type === 'bpmn:SignalEventDefinition')) {
          activity.on('end', (api) => {
            activity.environment.variables.message = api.content.output;
          });
        }
        if (activity.behaviour.resultVariable) {
          activity.on('end', (api) => {
            activity.environment.output[activity.behaviour.resultVariable] = api.content.output;
          });
        }
      },
    },
  });

  for (const sourceContext of sourceContexts) {
    engine.addSource({
      sourceContext
    });
  }

  engine.broker.subscribeTmp('event', 'activity.signal', (routingKey, msg) => {
    engine.execution.signal(msg.content.message, {ignoreSameDefinition: true});
  }, {noAck: true});

  return engine;
}

function ServiceExpression(activity) {
  const {type: atype, behaviour, environment} = activity;
  const expression = behaviour.expression;
  const type = `${atype}:expression`;
  return {
    type,
    expression,
    execute,
  };
  function execute(executionMessage, callback) {
    const serviceFn = environment.resolveExpression(expression, executionMessage);
    serviceFn.call(activity, executionMessage, (err, result) => {
      callback(err, result);
    });
  }
}

function formFormatting(activity, context, formData) {
  const {broker, environment} = activity;
  broker.subscribeTmp('event', 'activity.enter', (_, message) => {
    const form = {
      fields: {}
    };
    formData.fields.forEach((field) => {
      form.fields[field.id] = {...field};
      form.fields[field.id].defaultValue = environment.resolveExpression(form.fields[field.id].defaultValue, message);
    });
    broker.publish('format', 'run.form', { form });
  }, {noAck: true});
}

function ioFormatting(activity, context, ioData) {
  const {broker, environment} = activity;

  if (ioData.inputParameters) {
    broker.subscribeTmp('event', 'activity.enter', (_, message) => {
      const input = ioData.inputParameters.reduce((result, data) => {
        result[data.name] = environment.resolveExpression(data.value, message);
        return result;
      }, {});

      broker.publish('format', 'run.input', { input });
    }, {noAck: true});
  }
  if (ioData.outputParameters) {
    broker.subscribeTmp('event', 'activity.end', (_, message) => {
      ioData.outputParameters.forEach((data) => {
        context.environment.variables[data.name] = environment.output[data.name] = environment.resolveExpression(data.value, message);
      });
    }, {noAck: true});
  }
}
