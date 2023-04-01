'use strict';

const factory = require('../helpers/factory');
const testHelpers = require('../helpers/testHelpers');
const {Engine} = require('../..');

const signalsSource = factory.resource('signals.bpmn');
const sendSignalSource = factory.resource('send-signal.bpmn');

Feature('Multiple sources', () => {
  Scenario('Two definitions that communicates with signals', () => {
    let engine, signalContext, updateContext;
    Given('a trade process waiting for spot price update signal and another admin processs that updates price', async () => {
      signalContext = await testHelpers.context(signalsSource, {
        camunda: require('camunda-bpmn-moddle/resources/camunda'),
      });
      engine = getExtendedEngine({
        sourceContext: signalContext,
      });

      expect(await engine.getDefinitions()).to.have.length(1);
    });

    And('a second definition that updates spot price', async () => {
      updateContext = await testHelpers.context(sendSignalSource, {
        camunda: require('camunda-bpmn-moddle/resources/camunda'),
      });

      engine.addSource({
        sourceContext: updateContext,
      });

      expect(await engine.getDefinitions()).to.have.length(2);
    });

    let end, execution;
    When('engine is executed', async () => {
      end = engine.waitFor('end');
      execution = await engine.execute();
    });

    let tradeTask, spotPriceChanged;
    Then('trader is considering to trade', () => {
      [spotPriceChanged, tradeTask] = execution.getPostponed();
      expect(tradeTask).to.be.ok;
      expect(tradeTask.content.form.fields.price.defaultValue).to.equal(100);
    });

    And('spot price is monitored by process', () => {
      expect(spotPriceChanged).to.be.ok;
    });

    When('spot price is updated by second definition', () => {
      const [, updateDefinition] = execution.definitions;
      const [updateProcess] = updateDefinition.getProcesses();

      updateDefinition.on('activity.wait', () => {
        execution.signal({
          id: 'set-spot-price',
          form: {
            newPrice: 110,
          },
        });
      });

      updateDefinition.run({processId: updateProcess.id});
    });

    Then('admin is notified that spot price has been updated', () => {
      const [, , adminApprove] = execution.getPostponed();
      expect(adminApprove).to.have.property('id', 'approveSpotPrice');
      expect(adminApprove.content).to.have.property('form').with.property('fields').with.property('newPrice').with.property('defaultValue', 110);
    });

    And('the tasks can be retrieved by getActivityById', () => {
      expect(execution.getActivityById('tradeTask').counters).to.have.property('discarded', 0);
      expect(execution.getActivityById('approveSpotPrice').counters).to.have.property('taken', 0);
      expect(execution.getActivityById('not-in-at-all')).to.not.be.ok;
    });

    When('admin approves new spot price', () => {
      execution.signal({
        id: 'approveSpotPrice',
        form: {
          newPrice: 110,
        },
      });
    });

    Then('trade task is discarded', () => {
      [tradeTask, spotPriceChanged] = execution.getPostponed();
      expect(tradeTask.id).to.equal('tradeTask');
      expect(spotPriceChanged.id).to.equal('catchSpotUpdate');
      expect(tradeTask.owner.counters).to.have.property('discarded', 1);
    });

    And('trade task was discarded', () => {
      expect(execution.getActivityById(tradeTask.id).counters).to.have.property('discarded', 1);
    });

    And('update price is taken', () => {
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

    And('run is completed', () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters).to.have.property('completed', 1);
      expect(tradeDef.counters).to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters).to.have.property('completed', 1);
      expect(updateDef.counters).to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new spot price', () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 42,
        price: 110,
        spotPrice: 110,
      });
    });

    Given('definition is ran again', async () => {
      end = engine.waitFor('end');
      execution = await engine.execute();
    });

    When('trader trades again', () => {
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 42,
        },
      });
    });

    Then('run completes', () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters).to.have.property('completed', 1);
      expect(tradeDef.counters).to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters).to.have.property('completed', 0);
      expect(updateDef.counters).to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new spot price', () => {
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

    And('spot price is on the verge to be updated', () => {
      const [, updateDefinition] = execution.definitions;
      const [updateProcess] = updateDefinition.getProcesses();

      updateDefinition.run({processId: updateProcess.id});
    });

    let stopped, state;
    And('trade is paused', () => {
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
        },
      });
    });

    And('trade is paused', () => {
      execution.stop();
      state = execution.getState();
    });

    When('execution is recovered and resumed', async () => {
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
          newPrice: 100,
        },
      });
    });

    When('trader resumes trade', () => {
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 52,
        },
      });
    });

    Then('run completes', () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('completed', 1);
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('completed', 1);
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new approved spot price', () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 52,
        price: 100,
        spotPrice: 100,
      });
    });

    Given('the same engine is executed again', async () => {
      execution = await engine.execute();
    });

    And('state is saved when trader is trading', () => {
      state = execution.getState();
    });

    When('execution is recovered and resumed', async () => {
      engine = getExtendedEngine();
      engine.recover(state);
      execution = await engine.resume();
    });

    And('spot price is updated', () => {
      const [, updateDefinition] = execution.definitions;
      const [updateProcess] = updateDefinition.getProcesses();

      updateDefinition.on('activity.wait', () => {
        execution.signal({
          id: 'set-spot-price',
          form: {
            newPrice: 200,
          },
        });
      });

      updateDefinition.run({processId: updateProcess.id});
    });

    Then('admin approves new spot price', () => {
      execution.signal({
        id: 'approveSpotPrice',
        form: {
          newPrice: 200,
        },
      });
    });

    When('trader resumes trade', () => {
      end = engine.waitFor('end');
      execution.signal({
        id: 'tradeTask',
        form: {
          amount: 52,
        },
      });
    });

    Then('run completes', () => {
      const [tradeDef, updateDef] = execution.definitions;

      expect(tradeDef).to.have.property('id', 'Signals_0');
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('completed', 1);
      expect(tradeDef.counters, 'Signals_0 counters').to.have.property('discarded', 0);

      expect(updateDef).to.have.property('id', 'SendSignals_0');
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('completed', 1);
      expect(updateDef.counters, 'SendSignals_0 counters').to.have.property('discarded', 0);

      return end;
    });

    And('execution output has amount and new approved spot price', () => {
      expect(execution.environment.output).to.deep.equal({
        amount: 52,
        price: 200,
        spotPrice: 200,
      });
    });

    And('activity status is idle', () => {
      expect(engine.activityStatus).to.equal('idle');
    });
  });

  Scenario('edge cases', () => {
    let engine;
    Given('two sources', async () => {
      engine = new Engine({name: 'Edge case'});
      engine.addSource({
        sourceContext: await testHelpers.context(`
        <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <process id="Process_0" isExecutable="true">
            <userTask id="task_0" />
          </process>
        </definitions>`),
      });
      engine.addSource({
        sourceContext: await testHelpers.context(`
        <definitions id="Def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <process id="Process_1" isExecutable="true">
            <userTask id="task_1" />
          </process>
        </definitions>`),
      });
    });

    When('executed', () => {
      return engine.execute();
    });

    Then('both definitions has started', () => {
      expect(engine.execution.definitions.length).to.equal(2);
    });

    When('for some reason the first definition is stopped', () => {
      engine.execution.definitions[0].stop();
    });

    Then('engine is still running', () => {
      expect(engine.stopped).to.be.false;
      expect(engine.execution.stopped).to.be.false;
    });

    And('activity status is wait', () => {
      expect(engine.activityStatus).to.equal('wait');
    });

    When('the second definition is stopped', () => {
      engine.execution.definitions[1].stop();
    });

    Then('execution is stopped', () => {
      expect(engine.execution.stopped).to.be.true;
    });

    And('the engine is also flagged as stopped', () => {
      expect(engine.stopped).to.be.true;
    });

    Given('engine is executed again', () => {
      return engine.execute();
    });

    When('second definition hickups another start event', () => {
      expect(engine.execution.definitions).to.have.length(2);
      engine.execution.definitions[1].broker.publish('event', 'definition.enter', {});
    });

    Then('the engine ignores that one', () => {
      expect(engine.execution.definitions).to.have.length(2);
    });

    Given('engine is executed again', () => {
      return engine.execute();
    });

    When('first definition sends process output', () => {
      engine.execution.definitions[0].broker.publish('event', 'process.end', {
        output: {
          foo: 'bar',
          data: {col: 1},
        },
      });
    });

    And('second definition sends process undefined process output', () => {
      engine.execution.definitions[0].broker.publish('event', 'process.end', {});
    });

    Then('the engine ignores the second process output', () => {
      expect(engine.environment.output).to.deep.equal({
        foo: 'bar',
        data: {col: 1},
      });
    });

    Given('engine is executed again', () => {
      return engine.execute();
    });

    Then('activity status is wait', () => {
      expect(engine.activityStatus).to.equal('wait');
    });

    When('second definition completes', () => {
      engine.execution.signal({id: 'task_1'});
    });

    Then('activity status is wait for second definition', () => {
      expect(engine.activityStatus).to.equal('wait');
    });

    When('the other definition completes', () => {
      engine.execution.signal({id: 'task_0'});
    });

    Then('activity status is idle', () => {
      expect(engine.activityStatus).to.equal('idle');
    });
  });
});

function getExtendedEngine(options) {
  const engine = new Engine({
    name: 'Signal feature',
    settings: {
      strict: true,
      dataStores: new DataStores({
        SpotPriceDb: {price: 100},
      }),
    },
    services: {
      getSpotPrice(msg, callback) {
        return callback(null, this.environment.settings.dataStores.getDataStore(msg.content.db).price);
      },
    },
    ...options,
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
      datastore(activity) {
        if (activity.behaviour.dataInputAssociations) {
          activity.on('enter', () => {
            activity.broker.publish('format', 'run.enter.format', {
              db: activity.behaviour.dataInputAssociations[0].behaviour.sourceRef.id,
            });
          });
        }

        if (activity.behaviour.dataOutputAssociations) {
          activity.on('end', (api) => {
            const db = activity.behaviour.dataOutputAssociations[0].behaviour.targetRef.id;
            activity.environment.settings.dataStores.setDataStore(db, {...api.content.output});
          });
        }
      },
    },
  });

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
      fields: {},
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
    broker.subscribeTmp('event', 'activity.execution.completed', (_, message) => {
      const output = {};
      ioData.outputParameters.forEach((data) => {
        output[data.name] = environment.resolveExpression(data.value, message);
      });

      Object.assign(environment.output, output);

      broker.publish('format', 'run.output', { output });
    }, {noAck: true, consumerTag: '_camunda_io'});
  }
}

function DataStores(data) {
  this.data = data;
}

DataStores.prototype.getDataStore = function getDataStore(id) {
  return this.data[id];
};

DataStores.prototype.setDataStore = function setDataStore(id, value) {
  this.data[id] = value;
};
