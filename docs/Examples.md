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
    id: id
  }
}, (err, execution) => {
  console.log('Execution completed with id', execution);
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

listener.once('wait-userTask', (task) => {
  task.signal({
    sirname: 'von Rosen'
  });
});

listener.on('taken', (flow) => {
  console.log(`flow <${flow.id}> was taken`);
});

engine.once('end', (execution) => {
  console.log(`User sirname is ${execution.getOutput().inputFromUser}`);
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
      this.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.variables.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

const engine = Engine({
  name: 'exclusive gateway example',
  source
});

const listener = new EventEmitter();

listener.on('start-end1', (api) => {
  throw new Error(`<${api.id}> was not supposed to be taken, check your input`);
});
listener.on('start-end2', (api) => console.log(`<${api.id}> correct decision was taken`));

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

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        const request = services.request;

        const self = this;

        request.get('http://example.com/test', (err, resp, body) => {
          if (err) return next(err);
          self.variables.scriptTaskCompleted = true;
          next(null, {result: body});
        })
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
    request: {
      module: 'request'
    }
  }
});
engine.on('end', (execution) => {
  console.log('Output:', execution.getOutput());
});
```

# User task

User tasks waits for signal to complete. The signal function can be called on the emitted event or the executing instance.

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
  name: 'user task example 1',
  source
});

const listener = new EventEmitter();

listener.once('wait-userTask', (activityApi, processInstance) => {
  processInstance.signal(activityApi.id, {
    sirname: 'von Rosen'
  });
});

engine.execute({
  listener
}, (err, execution) => {
  if (err) throw err;
  console.log(`User sirname is ${execution.getOutput().inputFromUser}`);
});
```

Since, Imho, the data flow in bpmn2 is overcomplex the input is stored as `taskInput` with id if data associations dont´t exist.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <userTask id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'script task example',
  source
});

const listener = new EventEmitter();

listener.once('wait-userTask', (activityApi, processInstance) => {
  processInstance.signal(activityApi.id, {
    sirname: 'von Rosen'
  });
});

engine.execute({
  listener
}, (err, execution) => {
  if (err) throw err;

  console.log(`User sirname is ${execution.getOutput().taskInput.userTask.sirname}`);
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
const request = require('request');

const services = require('../test/helpers/testHelpers');
services.getRequest = (message, callback) => {
  request.get(message.variables.apiPath, {json: true}, (err, resp, body) => {
    if (err) return callback(err);
    return callback(null, {
      statusCode: resp.statusCode,
      data: body
    });
  });
};

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <serviceTask id="serviceTask" implementation="\${services.getRequest}" />
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="serviceTask" />
  <sequenceFlow id="flow2" sourceRef="serviceTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'service task example 1',
  source
});

engine.execute({
  variables: {
    apiPath: 'http://example.com/test'
  },
  services: {
    getRequest: {
      module: './test/helpers/testHelpers',
      fnName: 'getRequest'
    }
  }
}, (err, execution) => {
  if (err) throw err;

  console.log('Service task output:', execution.getOutput().taskInput.serviceTask);
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
const extensions = {
  js: require('../test/resources/JsExtension')
}

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
  <process id="Process_with_loop" isExecutable="true">
    <serviceTask id="recurring" name="Each item" implementation="\${services.loop}" js:result="sum">
      <multiInstanceLoopCharacteristics isSequential="true" js:collection="\${variables.input}" />
    </serviceTask>
    <boundaryEvent id="errorEvent" attachedToRef="recurring">
      <errorEventDefinition />
    </boundaryEvent>
  </process>
</definitions>
`;

const engine = Engine({
  source,
  extensions
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
