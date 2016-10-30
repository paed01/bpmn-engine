<!-- version -->
# 0.14.0 API Reference
<!-- versionstop -->

<!-- toc -->

- [Engine](#engine)
  - [`new Engine([options])`](#new-engineoptions)
  - [`execute([options], [callback])`](#executeoptions-callback)
    - [Execution `variables`](#execution-variables)
    - [Execution `services`](#execution-services)
    - [Execution `listener`](#execution-listener)
  - [`getState()`](#getstate)
  - [`stop()`](#stop)
  - [`resume(state, [options], [callback])`](#resumestate-options-callback)
  - [Activity events](#activity-events)
    - [Element events](#element-events)
    - [Sequence flow events](#sequence-flow-events)
- [Examples](#examples)
  - [Execute](#execute)
  - [Listen for events](#listen-for-events)
  - [Exclusive gateway](#exclusive-gateway)
  - [Script task](#script-task)
  - [User task](#user-task)

<!-- tocstop -->

## Engine

### `new Engine([options])`

Creates a new Engine object where:

- `options`
  - `listener`: an `EventEmitter` object
  - `source`: Bpmn definition source as String or Buffer

### `execute([options], [callback])`

Creates a new Engine object where:

- `options`
  - [`variables`](#execution-variables): Optional object with instance variables
  - [`services`](#execution-services): Optional object with service definitions
  - [`listener`](#execution-listener): an `EventEmitter` object
  - [`state`](#getstate): Saved state
- `callback`: optional callback
  - `err`: Error if any
  - `instance`: Main process instance

Execute a BPMN 2.0 definition. The `execute()`

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

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
  source: processXml
});

engine.execute((err, instance) => {
  if (err) throw err;
  instance.once('end', () => {
    console.log('completed')
  });
});
```

#### Execution `variables`

Execution variables are passed as the first argument to `#execute`. To be able to distinguish between variables and services the safest way is to pass the variables as any other name than `services`.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const engine = new Bpmn.Engine();

const variables = {
  input: 1
};

engine.execute({
  variables: variables
}, (err, instance) => {
  if (err) throw err;
  instance.once('end', () => {
    console.log('completed')
  });
});
```

#### Execution `services`

A service is a module used by e.g. a script tasks or a condition where:

- `object key`: Exposed name in script task
  - `module`: Module name
  - `type`: Optional type, supported types are `require` and `global`
  - `fnName`: Optional function name

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        const request = context.request;

        const self = this;

        request.get('http://example.com/test', (err, resp, body) => {
          if (err) return next(err);
          self.context.scriptTaskCompleted = true;
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
  source: processXml
});

const services = {
  request: {
    module: 'request'
  },
  getUser: {
    module: 'user-module',
    fnName: 'getUser'
  },
  require: {
    module: 'require',
    type: 'global'
  }
};

engine.execute({
  services: services
}, (err, instance) => {
  if (err) throw err;
  instance.once('end', () => {
    console.log('completed')
  });
});
```

#### Execution `listener`

An `EventEmitter` object with listeners. [Event names](#activity-events) are composed by activity event name and activity id, e.g. `wait-userTask`.

### `getState()`

To save state of a process, execute engine `#save` function.

The saved state will include the following content:
- `source`: Buffer representation of the definition
- `sourceHash`: Calculated md5 hash of the executing definition
- `processes`: Object with processes with id as key
  - `variables`: Execution variables
  - `services`: Execution services
  - `children`: List of child states
    - `entered`: Boolean indicating if the child is currently executing

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
  source: processXml
});

const listener = new EventEmitter();

let state;
listener.once('wait-userTask', (activity) => {
  state = engine.getState();
  console.log(JSON.stringify(state, null, 2));
});

engine.execute({
  listener: listener
}, listener, (err, execution) => {
  if (err) throw err;
});
```

### `stop()`

Execute engine `#stop` function.

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

const engine = new Bpmn.Engine(processXml);
const listener = new EventEmitter();

let state;
listener.once('wait-userTask', (activity) => {
  engine.stop();
  state = engine.getState();
});

engine.execute({
  listener: listener
}, (err, execution) => {
  if (err) throw err;
});
```

### `resume(state, [options], [callback])`

Execute engine `#resume` function with previously saved state.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

// Retrieve saved state
const state = db.getState('state-id');

const engine = new Bpmn.Engine();

engine.on('end', () => {
  console.log('resumed instance completed');
});

engine.resume(state, (err, instance) => {
  if (err) throw err;
});
```

### Activity events

Each activity and flow emits events when changing state.

#### Element events

- `enter`: An element is entered
- `start`: An element is started
- `wait`: An user task waits for signal
- `end`: A task has ended successfully
- `cancel`: An element execution was canceled
- `leave`: The execution left the element
- `error`: An error was emitted (unless a bound error event is in place)

#### Sequence flow events

- `taken`: The sequence flow was taken
- `discarded`: The sequence flow was discarded

## Examples

### Execute
```javascript
const Bpmn = require('bpmn-engine');
const shortid = require('shortid');

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
  source: processXml
});

engine.execute({
  variables: {
    shortid: shortid.generate()
  }
}, (err, instance) => {
  console.log('Process instance started with id', instance.variables.shortid);
});
```

### Listen for events
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
  source: processXml
});
const listener = new EventEmitter();

listener.once('wait-userTask', (activity) => {
  console.log('Signal userTask when waiting');
  activity.signal({
    sirname: 'von Rosen'
  });
});

engine.execute({
  listener: listener
}, (err, instance) => {
  if (err) throw err;

  instance.once('end', () => {
    console.log(`User sirname is ${instance.variables.taskInput.inputFromUser.sirname}`);
  });
});
```

### Exclusive gateway

An exclusive gateway will receive the available process variables as `this.context.variables`.

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
      this.context.variables.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.context.variables.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

const engine = new Bpmn.Engine({
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

### Script task

A script task will receive the data available on the process instance. So if `request` or another module is needed it has to be passed when starting the process. The script task also has a callback called `next` that takes an occasional error. The `next` callback has to be called for the process to proceed.

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
        const request = context.request;

        const self = this;

        request.get('http://example.com/test', (err, resp, body) => {
          if (err) return next(err);
          self.context.variables.scriptTaskCompleted = true;
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

const engine = new Bpmn.Engine(processXml);
engine.execute({
  services: {
    request: {
      module: 'request'
    }
  }
}, null, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    console.log('Script task modification:', execution.variables.scriptTaskCompleted);
    console.log('Script task output:', execution.variables.taskInput.scriptTask.result);
  });
});
```

### User task
```javascript
'use strict';

const Bpmn = require('bpmn-engine');

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

const engine = new Bpmn.Engine(processXml);
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
  source: processXml
});

const listener = new EventEmitter();

listener.once('wait-userTask', (child, instance) => {
  instance.signal(child.activity.id, {
    sirname: 'von Rosen'
  });
});

engine.execute(null, listener, (err, instance) => {
  if (err) throw err;

  instance.once('end', () => {
    console.log(`User sirname is ${instance.variables.taskInput.userTask.sirname}`);
  });
});
```

