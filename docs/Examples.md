Examples
========

<!-- toc -->

- [Execute](#execute)
- [Listen for events](#listen-for-events)
- [Exclusive gateway](#exclusive-gateway)
- [Script task](#script-task)
- [User task](#user-task)
- [Service task](#service-task)
- [Sequence flow with condition expression](#sequence-flow-with-condition-expression)
- [Task loop over collection](#task-loop-over-collection)
- [Extend form behaviour](#extend-form-behaviour)
- [Extend service task behaviour](#extend-service-task-behaviour)
- [Human performer and potential owner](#human-performer-and-potential-owner)
- [Traverse activities using definition shake](#traverse-activities-using-definition-shake)
- [Persist state on events](#persist-state-on-events)

<!-- tocstop -->

# Execute

```javascript
const {Engine} = require('bpmn-engine');

const id = Math.floor(Math.random() * 10000);

const source = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression>true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

const engine = Engine({
  name: 'execution example',
  source,
  variables: {
    id
  }
});

engine.execute((err, execution) => {
  console.log('Execution completed with id', execution.environment.variables.id);
});
```

# Listen for events

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="userTask">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" name="sirname" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'listen example',
  source
});

const listener = new EventEmitter();

listener.once('wait', (task) => {
  task.signal({
    ioSpecification: {
      dataOutputs: [{
        id: 'userInput',
        value: 'von Rosen',
      }]
    }
  });
});

listener.on('flow.take', (flow) => {
  console.log(`flow <${flow.id}> was taken`);
});

engine.once('end', (execution) => {
  console.log(execution.environment.variables);
  console.log(`User sirname is ${execution.environment.output.data.inputFromUser}`);
});

engine.execute({
  listener
}, (err) => {
  if (err) throw err;
});
```

# Exclusive gateway

An exclusive gateway will receive the available process variables as `this.environment.variables`.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.environment.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.environment.variables.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

const engine = Engine({
  name: 'exclusive gateway example',
  source
});

const listener = new EventEmitter();

listener.on('activity.start', (api) => {
  if (api.id === 'end1') throw new Error(`<${api.id}> was not supposed to be taken, check your input`);
  if (api.id === 'end2') console.log(`<${api.id}> correct decision was taken`);
});

engine.execute({
  listener,
  variables: {
    input: 51
  }
});

engine.on('end', () => {
  console.log('completed');
});
```

# Script task

A script task will receive the data available on the process instance. So if `bent` or another module is needed it has to be passed when starting the process. The script task also has a callback called `next` that has to be called for the task to complete.

The `next` callback takes the following arguments:
- `err`: occasional error
- `result`: optional result of the script

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const bent = require('bent');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        const self = this;
        const getJson = self.environment.services.get;
        const set = self.environment.services.set;
        getJson('https://example.com/test').then((result) => {
          self.environment.output.statusCode = 200;
          set(self, 'statusCode', 200)
          next(null, {result});
        }).catch((err) => {
          set(self, 'statusCode', err.statusCode);
          self.environment.output.statusCode = err.statusCode;
          next();
        });
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'script task example',
  source
});

engine.execute({
  variables: {
    scriptTaskCompleted: false
  },
  services: {
    get: bent('json'),
    set,
  }
});
engine.on('end', (execution) => {
  console.log('Output:', execution.environment.output);
});

function set(activity, name, value) {
  activity.logger.debug('set', name, 'to', value);
}
```

# User task

User tasks waits for signal to complete.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <userTask id="task" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'user task example 1',
  source
});

const listener = new EventEmitter();

listener.once('wait', (elementApi) => {
  elementApi.signal({
    sirname: 'von Rosen'
  });
});

listener.on('activity.end', (elementApi, engineApi) => {
  if (elementApi.content.output) engineApi.environment.output[elementApi.id] = elementApi.content.output;
});

engine.execute({
  listener
}, (err, execution) => {
  if (err) throw err;
  console.log(`User sirname is ${execution.environment.output.task.sirname}`);
});
```

# Service task

A service task will receive the data available on the process instance. The signature of the service function is:

- `scope`: activity scope
- `callback`:
  - `err`: occasional error
  - `result`: service call result

```javascript
'use strict';

const {Engine} = require('bpmn-engine');

const getJson = require('bent')('json');

async function getRequest(scope, callback) {
  try {
    var result = await getJson(scope.environment.variables.apiPath); // eslint-disable-line no-var
  } catch (err) {
    return callback(null, err);
  }

  return callback(null, result);
}

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <serviceTask id="serviceTask" implementation="\${environment.services.getRequest}" camunda:resultVariable="serviceResult" />
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="serviceTask" />
  <sequenceFlow id="flow2" sourceRef="serviceTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'service task example 1',
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  },
  extensions: {
    saveToResultVariable(activity) {
      if (!activity.behaviour.resultVariable) return;

      activity.on('end', ({environment, content}) => {
        environment.output[activity.behaviour.resultVariable] = content.output[0];
      });
    },
  }
});

engine.execute({
  variables: {
    apiPath: 'https://example.com/test'
  },
  services: {
    getRequest,
  }
}, (err, execution) => {
  if (err) throw err;

  console.log('Service task output:', execution.environment.output.serviceResult);
});
```

or as a expression function call:

```javascript
'use strict';

const {Engine} = require('bpmn-engine');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" implementation="\${environment.services.getService()}" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'service task example 3',
  source
});

engine.execute({
  services: {
    getService(defaultScope) {
      if (!defaultScope.content.id === 'serviceTask') return;
      return (executionContext, callback) => {
        callback(null, executionContext.environment.variables.input);
      };
    }
  },
  variables: {
    input: 1
  },
  extensions: {
    saveToEnvironmentOutput(activity, {environment}) {
      activity.on('end', (api) => {
        environment.output[api.id] = api.content.output;
      });
    }
  }
});

engine.once('end', (execution) => {
  console.log(execution.name, execution.environment.output);
});
```

# Sequence flow with condition expression

```javascript
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="testProcess" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess1" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3withExpression" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression">\${environment.services.isBelow(environment.variables.input,2)}</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
`;

const engine = Engine({
  name: 'sequence flow example',
  source
});

const listener = new EventEmitter();
listener.on('activity.end', (elementApi) => {
  if (elementApi.id === 'end2') throw new Error(`<${elementApi.id}> should not have been taken`);
});

engine.execute({
  listener,
  services: {
    isBelow: (input, test) => {
      return input < test;
    }
  },
  variables: {
    input: 2
  }
});

engine.once('end', () => {
  console.log('WOHO!');
});
```

# Task loop over collection

```javascript
const {Engine} = require('bpmn-engine');
const JsExtension = require('../test/resources/JsExtension');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
  <process id="Process_with_loop" isExecutable="true">
    <serviceTask id="recurring" name="Each item" implementation="\${environment.services.loop}" js:result="sum">
      <multiInstanceLoopCharacteristics isSequential="true" js:collection="\${environment.variables.input}" />
    </serviceTask>
    <boundaryEvent id="errorEvent" attachedToRef="recurring">
      <errorEventDefinition />
    </boundaryEvent>
  </process>
</definitions>`;

const engine = Engine({
  name: 'loop collection',
  source,
  moddleOptions: {
    js: JsExtension.moddleOptions
  },
  extensions: {
    js: JsExtension.extension
  },
});

let sum = 0;

engine.execute({
  services: {
    loop: (executionContext, callback) => {
      sum += executionContext.content.item;
      callback(null, sum);
    }
  },
  variables: {
    input: [1, 2, 3, 7]
  }
});

engine.once('end', () => {
  console.log(sum, 'aught to be 13 blazing fast');
});
```

# Extend form behaviour

Pass an extend function with options.

```javascript
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="pending" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theWaitingGame" isExecutable="true">
    <startEvent id="start" />
    <parallelGateway id="fork" />
    <userTask id="userTask1">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="surname" label="Surname" type="string" />
          <camunda:formField id="givenName" label="Given name" type="string" />
        </camunda:formData>
      </extensionElements>
    </userTask>
    <userTask id="userTask2" />
    <task id="task" />
    <parallelGateway id="join" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="fork" />
    <sequenceFlow id="flow2" sourceRef="fork" targetRef="userTask1" />
    <sequenceFlow id="flow3" sourceRef="fork" targetRef="userTask2" />
    <sequenceFlow id="flow4" sourceRef="fork" targetRef="task" />
    <sequenceFlow id="flow5" sourceRef="userTask1" targetRef="join" />
    <sequenceFlow id="flow6" sourceRef="userTask2" targetRef="join" />
    <sequenceFlow id="flow7" sourceRef="task" targetRef="join" />
    <sequenceFlow id="flowEnd" sourceRef="join" targetRef="end" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'Pending game',
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
  },
  extensions: {
    camunda: camundaExt
  }
});

const listener = new EventEmitter();

listener.on('wait', (elementApi) => {
  if (elementApi.content.form) {
    console.log(elementApi.content.form);
    return elementApi.signal(elementApi.content.form.fields.reduce((result, field) => {
      if (field.label === 'Surname') result[field.id] = 'von Rosen';
      if (field.label === 'Given name') result[field.id] = 'Sebastian';
      return result;
    }, {}));
  }

  elementApi.signal();
});

engine.execute({
  listener
});

function camundaExt(activity) {
  if (!activity.behaviour.extensionElements) return;
  let form;
  for (const extn of activity.behaviour.extensionElements.values) {
    if (extn.$type === 'camunda:FormData') {
      form = {
        fields: extn.fields.map((f) => ({...f}))
      };
    }
  }

  activity.on('enter', () => {
    activity.broker.publish('format', 'run.form', {form});
  });
}
```

# Extend service task behaviour

Add your own extension function that act on service task attributes.

```javascript
const {Engine} = require('bpmn-engine');

const source = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="task1" camunda:expression="\${environment.services.serviceFn}" camunda:resultVariable="result" />
  </process>
</definitions>`;

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

const engine = Engine({
  name: 'extend service task',
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
  },
  services: {
    serviceFn(scope, callback) {
      callback(null, {data: 1});
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

engine.execute((err, instance) => {
  if (err) throw err;
  console.log(instance.name, instance.environment.output);
});
```

# Human performer and potential owner

Publish event when human involvement is required.

```javascript
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <userTask id="task">
      <humanPerformer>
        <resourceAssignmentExpression>
          <formalExpression>\${environment.services.getUser()}</formalExpression>
        </resourceAssignmentExpression>
      </humanPerformer>
      <potentialOwner>
        <resourceAssignmentExpression>
          <formalExpression>user(pal), group(users)</formalExpression>
        </resourceAssignmentExpression>
      </potentialOwner>
    </userTask>
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
    <endEvent id="end" />
  </process>
</definitions>`;

function humanInvolvement(activity) {
  if (!activity.behaviour.resources || !activity.behaviour.resources.length) return;

  const humanPerformer = activity.behaviour.resources.find((resource) => resource.type === 'bpmn:HumanPerformer');
  const potentialOwner = activity.behaviour.resources.find((resource) => resource.type === 'bpmn:PotentialOwner');

  activity.on('enter', (api) => {
    activity.broker.publish('format', 'run.call.humans', {
      humanPerformer: api.resolveExpression(humanPerformer.expression),
      potentialOwner: api.resolveExpression(potentialOwner.expression),
    });
  });

  activity.on('wait', (api) => {
    api.owner.broker.publish('event', 'activity.call', {...api.content});
  });
}

const listener = new EventEmitter();

const engine = Engine({
  name: 'call humans',
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
  },
  services: {
    getUser() {
      return 'pal';
    }
  },
  extensions: {
    humanInvolvement
  }
});

listener.on('activity.call', (api) => {
  console.log('Make call to', api.content.humanPerformer);
  console.log('Owner:', api.content.potentialOwner);
  api.signal();
});

engine.execute({listener}, (err, instance) => {
  if (err) throw err;
  console.log(instance.name, 'completed');
});
```

# Traverse activities using definition shake

Shake down the possible sequences an activity can have.

```javascript
const {Engine} = require('bpmn-engine');
const BpmnModdle = require('bpmn-moddle');
const elements = require('bpmn-elements');
const {default: Serializer, TypeResolver} = require('moddle-context-serializer');

const source = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start">
      <outgoing>toSayHiTask1</outgoing>
    </startEvent>
    <task id="sayHiTask" name="say hi">
      <incoming>toSayHiTask1</incoming>
      <outgoing>toEnd1</outgoing>
      <outgoing>toEnd2</outgoing>
    </task>
    <sequenceFlow id="toSayHiTask1" sourceRef="start" targetRef="sayHiTask" />
    <endEvent id="end1">
      <incoming>toEnd1</incoming>
    </endEvent>
    <sequenceFlow id="toEnd1" sourceRef="sayHiTask" targetRef="end1" />
    <endEvent id="end2">
      <incoming>toEnd2</incoming>
    </endEvent>
    <sequenceFlow id="toEnd2" sourceRef="sayHiTask" targetRef="end2" />
  </process>
</definitions>`;

(async function IIFE() {
  const moddleContext = await (new BpmnModdle({
    camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
  })).fromXML(source);

  const sourceContext = Serializer(moddleContext, TypeResolver(elements));

  const engine = Engine({
    sourceContext,
  });

  const [definition] = await engine.getDefinitions();

  const shakenStarts = definition.shake();

  console.log('first sequence', shakenStarts.start[0].sequence.reduce(printSequence, ''));
  console.log('second sequence', shakenStarts.start[1].sequence.reduce(printSequence, ''));

  function printSequence(res, s) {
    if (!res) return s.id;
    res += ' -> ' + s.id;
    return res;
  }
})();
```

# Persist state on events

One way to persist state is to subscribe to activity and engine events through a listener.

In this example the state of the execution is published on a message broker. Subscribers to the broker will hopefylly know how to persist the state.

```js
const camundaModdle = require('camunda-bpmn-moddle/resources/camunda');
const {Engine: BpmnEngine} = require('bpmn-engine');
const {EventEmitter} = require('events');
const {getSourceSync, getAllowedServices, getExtensions} = require('./utils');
const {publish} = require('./dbbroker');
const {v4: uuid} = require('uuid');

function ignite(executionId, options = {}) {
  const {name, settings} = options;
  const listener = new EventEmitter();
  listener.on('activity.wait', (_, execution) => {
    return publishEvent('bpmn.state.update', {state: execution.getState()});
  });
  listener.on('activity.end', (_, execution) => {
    return publishEvent('bpmn.state.update', {state: execution.getState()});
  });
  listener.on('activity.timer', (api, execution) => {
    return publishEvent('bpmn.state.expires', {
      expires: new Date(api.content.startedAt + api.content.timeout),
      state: execution.getState(),
    });
  });
  listener.on('activity.timeout', (_, execution) => {
    return publishEvent('bpmn.state.expired', {
      expired: new Date(),
      state: execution.getState(),
    });
  });

  const engine = BpmnEngine({
    moddleOptions: {
      camunda: camundaModdle
    },
    ...options,
    settings: {
      ...settings,
      executionId,
      enableDummyService: false,
    }
  });
  engine.once('end', () => {
    publishEvent('bpmn.completed');
  });
  engine.once('error', (err) => {
    publishEvent('bpmn.error', {message: err.message, error: err});
  });

  return {engine, listener};

  function publishEvent(routingKey, message) {
    publish('events', routingKey, {
      name,
      executionId,
      ...message,
    });
  }
}

const {engine} = ignite(uuid(), {
  name: 'persisted engine #1',
  source: getSourceSync('./mother-of-all.bpmn'),
  services: getAllowedServices(),
  extensions: getExtensions(),
});

engine.execute();
```
