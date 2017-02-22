Examples
========

<!-- toc -->

- [Execute](#execute)
- [Listen for events](#listen-for-events)
- [Exclusive gateway](#exclusive-gateway)
- [Script task](#script-task)
- [User task](#user-task)
- [Service task](#service-task)
- [Sequence flow with expression](#sequence-flow-with-expression)
- [Task loop over collection](#task-loop-over-collection)

<!-- tocstop -->

# Execute
```javascript
const Bpmn = require('bpmn-engine');

const id = Math.floor(Math.random() * 10000);

const processXml = `
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

const engine = new Bpmn.Engine({
  name: 'execution example',
  source: processXml
});

engine.execute({
  variables: {
    id: id
  }
}, (err, definition) => {
  console.log('Bpmn definition definition started with id', definition.getProcesses()[0].context.variables.id);
});
```

# Listen for events

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="userTask">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine({
  name: 'listen example',
  source: processXml
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

engine.execute({
  listener: listener
}, (err, instance) => {
  if (err) throw err;

  instance.once('end', () => {
    console.log(`User sirname is ${instance.variables.inputFromUser.sirname}`);
  });
});
```

# Exclusive gateway

An exclusive gateway will receive the available process variables as `this.variables`.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const processXml = `
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

const engine = new Bpmn.Engine({
  name: 'exclusive gateway example',
  source: processXml
});

engine.execute({
  variables: {
    input: 51
  }
}, (err, instance) => {
  if (err) throw err;

  instance.once('end', () => {
    if (instance.getChildActivityById('end1').taken) throw new Error('<end1> was not supposed to be taken, check your input');
    console.log('TAKEN end2', instance.getChildActivityById('end2').taken);
  });
});
```

# Script task

A script task will receive the data available on the process instance. So if `request` or another module is needed it has to be passed when starting the process. The script task also has a callback called `next` that has to be called for the task to complete.

The `next` callback takes the following arguments:
- `err`: Occasional error
- `result`: The result of the script

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const processXml = `
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

const engine = new Bpmn.Engine({
  name: 'script task example',
  source: processXml
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
}, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    console.log('Script task modification:', execution.variables.scriptTaskCompleted);
    console.log('Script task output:', execution.variables.taskInput.scriptTask.result);
  });
});
```

# User task

User tasks waits for signal to complete. The signal function can be called on the emitted event or the executing instance.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="userTask">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine({
  name: 'user task example 1',
  source: processXml
});
const listener = new EventEmitter();

listener.once('wait-userTask', (child, instance) => {
  instance.signal(child.activity.id, {
    sirname: 'von Rosen'
  });
});

engine.execute({
  listener: listener
}, (err, instance) => {
  if (err) throw err;

  instance.once('end', () => {
    console.log(`User sirname is ${instance.variables.inputFromUser.sirname}`);
  });
});
```

Since, Imho, the data flow in bpmn2 is overcomplex the input is stored as `taskInput` with id if data associations dont´t exist.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
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

const engine = new Bpmn.Engine({
  name: 'script task example',
  source: processXml
});

const listener = new EventEmitter();

listener.once('wait-userTask', (child, instance) => {
  instance.signal(child.activity.id, {
    sirname: 'von Rosen'
  });
});

engine.execute({
  listener: listener
}, (err, instance) => {
  if (err) throw err;

  instance.once('end', () => {
    console.log(`User sirname is ${instance.variables.taskInput.userTask.sirname}`);
  });
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

const Bpmn = require('bpmn-engine');
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

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <serviceTask id="serviceTask">
    <extensionElements>
      <camunda:properties>
        <camunda:property name="service" value="getRequest" />
      </camunda:properties>
    </extensionElements>
  </serviceTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="serviceTask" />
  <sequenceFlow id="flow2" sourceRef="serviceTask" targetRef="theEnd" />
  </process>
</definitions>`;


const engine = new Bpmn.Engine({
  name: 'service task example 1',
  source: processXml,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
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

  execution.once('end', () => {
    console.log('Service task output:', execution.variables.taskInput.serviceTask);
  });
});
```

or if arguments must be passed, then `inputParameter` `arguments` must be defined. The result is an array with arguments from the service callback where first error argument is omitted.

```javascript
const Bpmn = require('bpmn-engine');

const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="Process_1" isExecutable="true">
      <startEvent id="start">
        <outgoing>flow1</outgoing>
      </startEvent>
      <sequenceFlow id="flow1" sourceRef="start" targetRef="serviceTask" />
      <endEvent id="end">
        <incoming>flow2</incoming>
      </endEvent>
      <sequenceFlow id="flow2" sourceRef="serviceTask" targetRef="end" />
      <serviceTask id="serviceTask" name="Get">
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="uri">
              <camunda:script scriptFormat="JavaScript">variables.apiPath</camunda:script>
            </camunda:inputParameter>
            <camunda:outputParameter name="result">
              <camunda:script scriptFormat="JavaScript"><![CDATA[
'use strict';
var result = {
  statusCode: result[0].statusCode,
  body: result[0].statusCode === 200 ? JSON.parse(result[1]) : undefined
};
result;
              ]]>
              </camunda:script>
            </camunda:outputParameter>
          </camunda:inputOutput>
          <camunda:properties>
            <camunda:property name="service" value="getRequest" />
          </camunda:properties>
        </extensionElements>
        <incoming>flow1</incoming>
        <outgoing>flow2</outgoing>
      </serviceTask>
    </process>
  `;

const engine = new Bpmn.Engine({
  source: processXml,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});

engine.execute({
  variables: {
    apiPath: 'http://example.com/test'
  },
  services: {
    getRequest: {
      module: 'request',
      fnName: 'get'
    }
  }
}, (err, execution) => {
  if (err) throw err;
  execution.once('end', () => {
    console.log(execution.variables)
    console.log('Script task output:', execution.variables.result);
  });
});
```

In the above example `request.get` will be called with `variables.apiPath`. The result is saved on `variables.result`.

Expressions can also be used if camunda extension `moddleOptions` are passed to engine.

```javascript
const Bpmn = require('bpmn-engine');

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService()}" camunda:resultVariable="output" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine({
  name: 'service task example 3',
  source: processXml,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
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
}, (err, instance) => {
  if (err) throw err;
  instance.once('end', () => {
    console.log(instance.variables.taskInput.serviceTask.output);
  });
});
```

# Sequence flow with expression

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const sourceXml = `
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

const engine = new Bpmn.Engine({
  name: 'sequence flow example',
  source: sourceXml
});
const listener = new EventEmitter();
listener.on('taken-flow3withExpression', (flow) => {
  throw new Error(`<${flow.id}> should not have been taken`);
});
engine.execute({
  listener: listener,
  services: {
    isBelow: (input, test) => {
      return input < Number(test);
    }
  },
  variables: {
    input: 2
  }
}, (err, instance) => {
  if (err) throw err;
  instance.once('end', () => {
    console.log('WOHO!');
  });
});

```

# Task loop over collection

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const sourceXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id= "Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="recurring" name="Each item">
      <multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.input}" />
      <extensionElements>
        <camunda:inputOutput>
          <camunda:outputParameter name="sum">\${result[0]}</camunda:outputParameter>
        </camunda:inputOutput>
        <camunda:connector>
          <camunda:connectorId>loop</camunda:connectorId>
        </camunda:connector>
      </extensionElements>
    </serviceTask>
    <boundaryEvent id="errorEvent" attachedToRef="recurring">
      <errorEventDefinition />
    </boundaryEvent>
  </process>
</definitions>
`;

const engine = new Bpmn.Engine({
  source: sourceXml,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});

engine.execute({
  services: {
    loop: (executionContext, callback) => {
      const prevResult = executionContext.variables.sum ? executionContext.variables.sum : 0;
      const result = prevResult + executionContext.item;
      callback(null, result);
    }
  },
  variables: {
    input: [1, 2, 3, 7]
  }
}, (err, instance) => {
  if (err) return console.log(err);
  instance.once('end', () => {
    console.log(instance.variables.sum, 'aught to be 13 blazing fast');
  });
});
```
