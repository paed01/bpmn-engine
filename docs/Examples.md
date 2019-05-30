Examples
========

<!-- toc -->

- [Define service](#define-service)
  - [Expression](#expression)
- [Execute](#execute)
- [Listen for events](#listen-for-events)
- [Exclusive gateway](#exclusive-gateway)
- [Script task](#script-task)
- [User task](#user-task)
- [Service task](#service-task)
- [Sequence flow with expression](#sequence-flow-with-expression)
- [Task loop over collection](#task-loop-over-collection)

<!-- tocstop -->

# Define service

How to reference service function.

## Expression

# Execute
```javascript
'use strict';

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
  source
});

engine.execute({
  variables: {
    id
  }
}, (err, execution) => {
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
  console.log(execution.environment.variables)
  console.log(`User sirname is ${execution.environment.output.inputFromUser}`);
});

engine.execute({
  listener
}, (err, instance) => {
  if (err) throw err;
});
```

# Exclusive gateway

An exclusive gateway will receive the available process variables as `this.variables`.

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

A script task will receive the data available on the process instance. So if `request` or another module is needed it has to be passed when starting the process. The script task also has a callback called `next` that has to be called for the task to complete.

The `next` callback takes the following arguments:
- `err`: Occasional error
- `result`: The result of the script

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
        const getJson = this.environment.services.get;
        getJson('http://example.com/test').then((resp) => {
          if (err) return next(err);
          this.environment.output.statusCode = err.statusCode;
          next(null, {result: resp.body});
        }).catch((err) => {
          this.environment.output.statusCode = err.statusCode;
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
  }
});
engine.on('end', (execution) => {
  console.log('Output:', execution.environment.output);
});
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

- `message`:
  - `variables`: Instance variables
  - `services`: All instance services
- `callback`:
  - `err`: Occasional error
  - `result`: The results of the service call arguments without the first argument (error)

```javascript
'use strict';

const {Engine} = require('bpmn-engine');

const getJson = require('bent')('json');

async function getRequest(scope, callback) {
  try {
    var result = await getJson(scope.environment.variables.apiPath);
  } catch (err) {
    return callback(null, err);
  }

  return callback(null, result.body);
}

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <serviceTask id="serviceTask" implementation="\${environment.services.getRequest}" camunda:result="serviceResult" />
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
    fetchForm(activity) {
      if (!activity.behaviour.result) return;
      const endRoutingKey = 'run.result.end';
      activity.on('end', (_, {content}) => {
        console.log(content)
      });
    },
    saveToEnvironmentOutput(activity, {environment}) {
      activity.on('end', (api) => {
        environment.output[api.id] = api.content.output;
      });
    }
  }
});

engine.execute({
  variables: {
    apiPath: 'http://example.com/test'
  },
  services: {
    getRequest,
  }
}, (err, execution) => {
  if (err) throw err;

  console.log('Service task output:', execution.environment.output);
});
```

or if arguments must be passed, then `inputParameter` `arguments` must be defined. The result is an array with arguments from the service callback where first error argument is omitted.

```javascript
const {Engine} = require('bpmn-engine');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" implementation="\${services.getService()}" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'service task example 3',
  source
});

engine.execute({
  services: {
    getService: () => {
      return (executionContext, callback) => {
        callback(null, executionContext.variables.input);
      };
    }
  },
  variables: {
    input: 1
  }
});

engine.once('end', (execution) => {
  console.log(execution.getOutput().taskInput.serviceTask);
});
```

# Sequence flow with expression

```javascript
'use strict';

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
      <conditionExpression xsi:type="tFormalExpression">\${services.isBelow(variables.input,2)}</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
`;

const engine = Engine({
  name: 'sequence flow example',
  source
});

const listener = new EventEmitter();
listener.on('end-end2', (api) => {
  throw new Error(`<${api.id}> should not have been taken`);
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
'use strict';

const {Engine} = require('bpmn-engine');
const JsExtension = require('../test/resources/JsExtension')
const extensions = {
  js: JsExtension.extension
};

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
  <process id="Process_with_loop" isExecutable="true">
    <serviceTask id="recurring" name="Each item" implementation="\${environment.services.loop}" js:result="sum">
      <multiInstanceLoopCharacteristics isSequential="true" js:collection="\${environment.variables.input}" />
    </serviceTask>
    <boundaryEvent id="errorEvent" attachedToRef="recurring">
      <errorEventDefinition />
    </boundaryEvent>
  </process>
</definitions>
`;

const engine = Engine({
  source,
  moddleOptions: JsExtension.moddleOptions,
  extensions,
});

let sum = 0;

engine.execute({
  services: {
    loop: (executionContext, callback) => {
      sum += executionContext.item;
      callback(null, sum);
    }
  },
  variables: {
    input: [1, 2, 3, 7]
  }
});

engine.once('end', (execution) => {
  console.log(sum, 'aught to be 13 blazing fast');
});
```
