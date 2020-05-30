'use strict';

const factory = require('../helpers/factory');
const {Engine} = require('../..');

const signalsSource = factory.resource('signals.bpmn');

Feature('Api', () => {
  Scenario('Two processes that communicates with signals', () => {
    let engine;
    Given('a trade process waiting for spot price update signal and another admin processs that updates price', async () => {
      engine = Engine({
        name: 'Signal feature',
        source: signalsSource,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        },
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
            if (activity.behaviour.resultVariable) {
              activity.on('end', (api) => {
                activity.environment.output[activity.behaviour.resultVariable] = api.content.output;
              });
            }
          },
        },
      });
    });

    let end, execution;
    When('definition is ran', async () => {
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

    Given('spot price is updated', async () => {
      const signal = execution.getActivityById('spotPriceUpdate');
      execution.signal(signal.resolve());
    });

    When('admin approves new spot price', () => {
      const [,, approveNewPriceTask] = execution.getPostponed();
      approveNewPriceTask.signal({
        form: {
          newPrice: 110
        }
      });
    });

    Then('trade task is discarded', async () => {
      [tradeTask, spotPriceChanged] = execution.getPostponed();
      expect(tradeTask.owner.counters).to.have.property('discarded', 1);
    });

    And('update price is taken', async () => {
      expect(spotPriceChanged.owner.counters).to.have.property('taken', 1);
    });

    And('trader is presented new price', () => {
      expect(tradeTask.content.form.fields.price.defaultValue).to.equal(110);
    });

    When('trader trades', () => {
      tradeTask.signal({form: {amount: 42}});
    });

    And('trade task is taken', () => {
      expect(tradeTask.owner.counters).to.have.property('taken', 1);
      expect(tradeTask.owner.counters).to.have.property('discarded', 1);
    });

    And('run is completed', async () => {
      return end;
    });

    And('execution output has amount and new spot price', async () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 42,
        price: 110,
        spotPrice: 110,
      });
    });
  });
});

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
