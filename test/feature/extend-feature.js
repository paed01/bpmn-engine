const { Activity } = require('bpmn-elements');
const { Engine } = require('../..');
const { EventEmitter } = require('events');

Feature('extending behaviour', () => {
  Scenario('Activity form', () => {
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
              activity.broker.publish('format', 'run.form.start', { endRoutingKey });

              getForm(activity).then((form) => {
                activity.broker.publish('format', endRoutingKey, { form });
              });
            });
          },
          saveToEnvironmentOutput(activity, { environment }) {
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
      expect(engine.environment.output).to.have.property('task1').that.eql({ surname: 'von Rosen' });
      expect(engine.environment.output).to.have.property('task2', 2);
    });
  });

  Scenario('Service task expression', () => {
    let source;
    Given('a bpmn source with user tasks', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="task1" camunda:expression="\${environment.services.serviceFn}" camunda:resultVariable="result" />
        </process>
      </definitions>`;
    });

    let ServiceExpression;
    And('an service expression function', () => {
      ServiceExpression = function ServiceExpressionFn(activity) {
        const { type: atype, behaviour, environment } = activity;
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
      };
    });

    let engine;
    And('an engine loaded with extension for fetching form and saving output', () => {
      engine = Engine({
        name: 'extend service task',
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        },
        services: {
          serviceFn(scope, callback) {
            callback(null, { data: 1 });
          }
        },
        extensions: {
          camundaServiceTask(activity) {
            if (activity.behaviour.expression) {
              activity.behaviour.Service = ServiceExpression;
            }
            if (activity.behaviour.resultVariable) {
              activity.on('end', (api) => {
                activity.environment.output[activity.behaviour.resultVariable] = api.content.output;
              });
            }
          },
        }
      });
    });

    let completed;
    When('source is executed', async () => {
      completed = engine.waitFor('end');
      return engine.execute();
    });

    And('engine completes execution', () => {
      return completed;
    });

    Then('extension have saved output in environment', () => {
      expect(engine.environment.output).to.have.property('result').that.eql({ data: 1 });
    });
  });

  Scenario('Scripts', () => {
    let engine, source;
    Given('a bpmn source with user tasks', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="task1">
            <script>Placeholder</script>
          </scriptTask>
        </process>
      </definitions>`;
    });

    And('an engine loaded with extension for fetching form and saving output', () => {
      engine = Engine({
        name: 'Engine feature',
        source,
        scripts: {
          register() { },
          getScript(scriptType, activity) {
            if (activity.id === 'task1') {
              return {
                execute(scope, next) {
                  scope.environment.output.myScript = 1;
                  next();
                }
              };
            }
          }
        }
      });
    });

    let api;
    When('source is executed', async () => {
      api = await engine.execute();
    });

    Then('engine comletes run', () => {
      expect(api.state).to.equal('idle');
    });

    And('extension have saved output in environment', () => {
      expect(engine.environment.output).to.have.property('myScript', 1);
    });
  });

  Scenario('End event with extension (issue #25)', () => {
    let source;
    Given('a source with extension elements on end event', () => {
      source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" />
          <endEvent id="end">
            <extensionElements>
              <camunda:InputOutput>
                <camunda:inputParameter name="data">\${environment.variables.statusCode}</camunda:inputParameter>
              </camunda:InputOutput>
            </extensionElements>
          </endEvent>
          <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
        </process>
      </definitions>`;
    });

    let listener, startEventMessage, endEventMessage;
    And('a listening device', () => {
      listener = new EventEmitter();

      listener.on('activity.start', (elementApi) => {
        if (elementApi.type === 'bpmn:EndEvent') {
          startEventMessage = elementApi;
        }
      });
      listener.on('activity.end', (elementApi) => {
        if (elementApi.type === 'bpmn:EndEvent') {
          endEventMessage = elementApi;
        }
      });
    });

    let ioExtension;
    And('an extension function that handles extension', () => {
      ioExtension = function inputOutputExtension(activity) {
        if (!activity.behaviour.extensionElements || !activity.behaviour.extensionElements.values) return;

        const extendValues = activity.behaviour.extensionElements.values;
        const io = extendValues.reduce((result, extension) => {
          if (extension.$type === 'camunda:InputOutput') {
            result.input = extension.inputParameters;
          }
          return result;
        }, {});

        activity.on('enter', (elementApi) => {
          activity.broker.publish('format', 'run.io', {
            io: {
              input: io.input.map(({ name, value }) => ({
                name,
                value: elementApi.resolveExpression(value),
              }))
            }
          });
        });
      };
    });

    let engine;
    And('an engine', () => {
      engine = Engine({
        source,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        },
        extensions: {
          ioExtension
        }
      });
    });

    When('executing', (done) => {
      engine.execute({
        listener,
        variables: {
          statusCode: 200
        }
      }, done);
    });

    Then('start event message has the expected extension data', () => {
      expect(startEventMessage.content).to.have.property('io').with.property('input').that.have.length(1);
      expect(startEventMessage.content.io.input[0]).to.have.property('name', 'data');
      expect(startEventMessage.content.io.input[0]).to.have.property('value', 200);
    });

    And('end event message has the expected extension data', () => {
      expect(endEventMessage.content).to.have.property('io').with.property('input').that.have.length(1);
      expect(endEventMessage.content.io.input[0]).to.have.property('name', 'data');
      expect(endEventMessage.content.io.input[0]).to.have.property('value', 200);
    });
  });

  Scenario('Replace element behaviour (issue #70)', () => {
    let source;
    Given('a source with a gateway', () => {
      source = `
      <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
          <exclusiveGateway id="decision" default="flow2" />
          <sequenceFlow id="flow2" name="pick me" sourceRef="decision" targetRef="end" />
          <sequenceFlow id="flow3" name="no, pick me" sourceRef="decision" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression">\${content.condition}</conditionExpression>
          </sequenceFlow>
          <endEvent id="end" />
        </process>
      </definitions>`;
    });

    let MyExclusiveGateway;
    And('a ExclusiveGateway behaviour that published decision message', () => {
      MyExclusiveGateway = function ExclusiveGateway(activityDef, context) {
        return Activity(ExclusiveGatewayBehaviour, activityDef, context);
      };

      function ExclusiveGatewayBehaviour(activity) {
        const { broker, outbound: outboundFlows } = activity;

        return {
          execute,
        };

        function execute(executeMessage) {
          broker.publish('event', 'activity.decide', {
            ...executeMessage.content,
            decisions: outboundFlows.map((f) => {
              const { id, name, type } = f;
              return { id, name, type };
            })
          });

          broker.subscribeTmp('api', 'activity.#', onApiMessage, { noAck: true, consumerTag: '_my-exclusive-gateway' });

          function onApiMessage(_, message) {
            const type = message.properties.type;
            switch (type) {
              case 'discard':
              case 'stop': {
                return broker.cancel('_my-exclusive-gateway');
              }
              case 'signal': {
                const takenId = message.content.message.id;
                const outbound = [];
                for (const flow of outboundFlows) {
                  if (flow.id === takenId) outbound.push({ id: flow.id, action: 'take' });
                  else outbound.push({ id: flow.id, action: 'discard' });
                }

                return broker.publish('execution', 'execute.completed', {
                  ...executeMessage.content,
                  outbound,
                });
              }
            }
          }
        }
      }
    });

    let listener, decideApi;
    And('a listening device', () => {
      listener = new EventEmitter();

      listener.on('activity.decide', (elementApi) => {
        decideApi = elementApi;
      });
    });

    let engine, end;
    And('an engine with overide elements', () => {
      engine = Engine({
        source,
        listener,
        elements: {
          ExclusiveGateway: MyExclusiveGateway
        }
      });
      end = engine.waitFor('end');
    });

    let execution;
    When('executing', async () => {
      execution = await engine.execute();
    });

    Then('decision message has the expected decisions', () => {
      expect(decideApi).to.be.ok;
      expect(decideApi.content).to.have.property('decisions').with.length(2);
      expect(decideApi.content.decisions[0]).to.have.property('name', 'pick me');
      expect(decideApi.content.decisions[1]).to.have.property('name', 'no, pick me');
    });

    When('decision is made by signal', () => {
      decideApi.signal(decideApi.content.decisions[0]);
    });

    Then('run completes', () => {
      return end;
    });

    And('decided flow was taken', () => {
      const flow = execution.definitions[0].context.getSequenceFlowById('flow2');
      expect(flow.counters).to.have.property('take', 1);
    });

    And('second flow was discarded', () => {
      const flow = execution.definitions[0].context.getSequenceFlowById('flow3');
      expect(flow.counters).to.have.property('discard', 1);
    });
  });

  Scenario('Extension elements behaviour (issue #72)', () => {
    let source;
    Given('a source with a task with script extension', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_16cv7x0" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="3.3.2">
        <process id="Process_0deeeh6" isExecutable="true">
          <extensionElements>
            <camunda:executionListener class="" event="start" />
          </extensionElements>
          <startEvent id="StartEvent_0wbnjd7" name="s">
            <outgoing>SequenceFlow_1nigfug</outgoing>
          </startEvent>
          <task id="Task_1dcqqes" name="helloworld" camunda:asyncAfter="true">
            <extensionElements>
              <camunda:executionListener event="start">
                <camunda:script scriptFormat="javascript" resource="/Users/workflowtest/hello.js" />
              </camunda:executionListener>
            </extensionElements>
            <incoming>SequenceFlow_1nigfug</incoming>
            <outgoing>SequenceFlow_1ilvvs7</outgoing>
          </task>
          <endEvent id="EndEvent_08ib9fm" name="e">
            <incoming>SequenceFlow_1ilvvs7</incoming>
          </endEvent>
          <sequenceFlow id="SequenceFlow_1nigfug" sourceRef="StartEvent_0wbnjd7" targetRef="Task_1dcqqes" />
          <sequenceFlow id="SequenceFlow_1ilvvs7" sourceRef="Task_1dcqqes" targetRef="EndEvent_08ib9fm" />
        </process>
      </definitions>`;
    });

    let extensions;
    And('an extension executing script on task start', () => {
      extensions = {
        extension: Extension
      };

      function Extension(activity) {
        if (!activity.behaviour.extensionElements) return;

        const { broker, environment } = activity;
        const myExtensions = [];

        for (const extension of activity.behaviour.extensionElements.values) {
          switch (extension.$type) {
            case 'camunda:ExecutionListener': {
              myExtensions.push(ExecutionListener(extension));
              break;
            }
          }
        }

        return {
          extensions: myExtensions,
          activate(...args) {
            myExtensions.forEach((e) => e.activate(...args));
          },
          deactivate() {
            myExtensions.forEach((e) => e.deactivate());
          },
        };

        function ExecutionListener(extension) {
          return {
            activate() {
              const script = environment.scripts.getScript(extension.script.scriptFormat, { id: extension.script.resource });
              broker.subscribeTmp('event', `activity.${extension.event}`, (routingKey, message) => {
                script.execute(message);
              }, { noAck: true, consumerTag: '_my-extension' });
            },
            deactivate() {
              broker.cancel('_my-extension');
            }
          };
        }

      }
    });

    let engine, end, executed;
    And('an engine with extensions and special script handling', () => {
      engine = Engine({
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda'),
        },
        source,
        extensions,
        scripts: ExternalScripts(),
      });

      end = engine.waitFor('end');

      function ExternalScripts() {
        return {
          getScript,
          register,
        };

        function getScript(_, { id }) {
          if (id === '/Users/workflowtest/hello.js') {
            return {
              execute(message) {
                executed = message;
              }
            };
          }
        }

        function register() { }
      }
    });

    When('executing', async () => {
      return engine.execute();
    });

    Then('extension elements script was executed on activity start', () => {
      expect(executed).to.be.ok;
      expect(executed.fields).to.have.property('routingKey', 'activity.start');
    });

    And('run completed', () => {
      return end;
    });
  });
});
