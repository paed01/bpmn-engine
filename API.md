<!-- version -->
# 3.0.0 API Reference
<!-- versionstop -->

<!-- toc -->

- [Engine](#engine)
  - [`new Engine([options])`](#new-engineoptions)
  - [`execute([options[, callback]])`](#executeoptions-callback)
    - [Execution `variables`](#execution-variables)
    - [Execution `services`](#execution-services)
    - [Execution `listener`](#execution-listener)
  - [`getState()`](#getstate)
  - [`stop()`](#stop)
  - [`resume(state, [options], [callback])`](#resumestate-options-callback)
  - [`getDefinitions(callback)`](#getdefinitionscallback)
  - [`getDefinition(callback)`](#getdefinitioncallback)
  - [Engine events](#engine-events)
  - [Activity events](#activity-events)
    - [Element events](#element-events)
    - [Sequence flow events](#sequence-flow-events)
  - [Expressions](#expressions)
  - [Task loop](#task-loop)
    - [Cardinality loop](#cardinality-loop)
    - [Conditional loop](#conditional-loop)
    - [Collection loop](#collection-loop)
- [Transformer](#transformer)
  - [`transform(sourceXml, options, callback)`](#transformsourcexml-options-callback)
- [Validation](#validation)
  - [`validateModdleContext(moddleContext)`](#validatemoddlecontextmoddlecontext)
  - [`validateOptions(executeOptions)`](#validateoptionsexecuteoptions)

<!-- tocstop -->

## Engine

### `new Engine([options])`

Creates a new Engine object where:

- `options`: Optional object
  - `source`: Bpmn definition source as String or Buffer
  - `moddleContext`: Optional parsed moddle context object
  - `name`: Optional name of engine,
  - `moddleOptions`: Optional moddle parse options

Options `source` and `context` are mutually exclusive.

Moddle options can be used if an extension is required when parsing BPMN-source. The object will be passed on to the constructor of `bpmn-moddle`. See [camunda-bpmn-moddle][1] for example.

```javascript
const Bpmn = require('bpmn-engine');
const fs = require('fs');

const engine = new Bpmn.Engine({
  source: fs.readFileSync('./test/resources/mother-of-all.bpmn'),
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});
```

### `execute([options[, callback]])`

Execute definition with:

- `options`: Optional object
  - [`listener`](#execution-listener): an `EventEmitter` object
  - [`variables`](#execution-variables): Optional object with instance variables
  - [`services`](#execution-services): Optional object with service definitions
- `callback`: optional callback
  - `err`: Error if any
  - `definition`: Executing definition
  - `siblings`: List of all definitions including executing

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

engine.execute((err, definition) => {
  if (err) throw err;
  definition.once('end', () => {
    console.log('completed')
  });
});
```

#### Execution `variables`

Execution variables are passed as the first argument to `#execute`.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const fs = require('fs');

const engine = new Bpmn.Engine({
  source: fs.readFileSync('./test/resources/simple-task.bpmn')
});

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

```javascript
const options = {
  services: {
    get: {
      module: 'request',
      type: 'require',
      fnName: 'get'
    },
    checkState: (message) => {
      return message.variables.statusCode === 200;
    }
  }
};
```

- `name`: Exposed name in the engine
  - `module`: Module or global name
  - `type`: Optional type, supported types are `require` and `global`, defaults to `require`
  - `fnName`: Optional module function name

If the process will be stopped and resumed the module structure is to prefer. But it is also possible to send in functions, aware that they will not be serialized when getting state.

The module name can be a npm module, local module or a global reference. If a local module is used the path must be relative from execution path, i.e. `process.cwd()`.

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
  source: processXml
});

const services = {
  request: {
    module: 'request'
  },
  put: {
    module: 'request',
    fnName: 'put'
  },
  require: {
    module: 'require',
    type: 'global'
  },
  serviceFn: {
    module: './test/helpers/testHelpers',
    fnName: 'serviceFn'
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

Event arguments are:

- `activity`: The activity instance
- `instance`: The running process instance

### `getState()`

Get state of a running execution.

The saved state will include the following content:

- `state`: `running` or `idle`
- `moddleOptions`: Engine moddleOptions
- `definitions`: List of definitions
  - `state`: State of definition, `pending`, `running`, or `completed`
  - `processes`: Object with processes with id as key
    - `variables`: Execution variables
    - `services`: Execution services
    - `children`: List of child states
      - `entered`: Boolean indicating if the child is currently executing

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');

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

let state;
listener.once('wait-userTask', (activity) => {
  state = engine.getState();
  fs.writeFileSync('./tmp/some-random-id.json', JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
});

engine.execute({
  listener: listener
}, (err, execution) => {
  if (err) throw err;
});
```

### `stop()`

Stop execution. The instance is terminated.

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

let state;
listener.once('wait-userTask', (activity) => {
  engine.stop();
  state = engine.getState();
});

engine.execute({
  variables: {
    executionId: 'some-random-id'
  },
  listener: listener
}, (err, execution) => {
  if (err) throw err;
});
```

### `resume(state, [options, [callback]])`

Execute engine `#resume` function with previously saved state.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

// Retrieve saved state
const state = db.getState('some-random-id', (err, state) => {
  if (err) return console.log(err.message);

  const engine = new Bpmn.Engine();

  engine.on('end', () => {
    console.log('resumed instance completed');
  });

  engine.resume(state, (err, instance) => {
    if (err) throw err;
  });
});
```

### `getDefinitions(callback)`

Get definitions. Loads definitions from sources or passed moddle contexts.

### `getDefinition(callback)`

Utility function to get first definition.

### Engine events

Engine emits the following events:

- `end`: Execution has completed or was stopped.

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

### Expressions

Expressions come in the form of `${<variables or services>.<property name>}`.

The following expressions are supported:

- `${variables.input}` - resolves to the variable input
- `${variables.input[0]}` - resolves to first item of the variable input array
- `${variables.input[spaced name]}` - resolves to the variable input object property `spaced name`

- `${services.getInput}` - return the service function `getInput`
- `${services.getInput()}` - executes the service function `getInput` with the argument `{services, variables}`
- `${services.isBelow(variables.input,2)}` - executes the service function `isBelow` with result of `variable.input` value and 2

Expressions are supported in the following elements:
- MultiInstanceLoopCharacteristics
  - `camunda:collection`: variable collection, e.g. `${variables.list}`
- ServiceTask
  - `camunda:expression` element value. moddleOptions [`require('camunda-bpmn-moddle/resources/camunda')`][1] must be used.
- SequenceFlow
  - `conditionExpression` element value
- TimerEvent
  - `timeDuration` element value

### Task loop

Task loops can made based conditions, cardinality, or a collection.

#### Cardinality loop

Loop a fixed number of times or until number of iterations match cardinality. The condition body can be a script or an expression.

```xml
<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">${variables.list.length}</bpmn:loopCardinality>
```

#### Conditional loop

Loop until condition is met. The condition body can be a script or an expression.

```xml
<completionCondition xsi:type="tFormalExpression">\${services.condition(variables.input)}</completionCondition>
```

#### Collection loop

Loop all items in a list.

```xml
<bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${variables.list}" />
```

For `bpmn-moddle` to read the `camunda:collection` namespaced attribute, the engine must be instantiated with moddle options referring [`camunda-bpmn-moddle/resources/camunda`][1].

## Transformer

Basically a wrapper around [`bpmn-moddle.fromXml`][2].

### `transform(sourceXml, options, callback)`

- `sourceXml`: String with bpmn definition source
- `options`: Options to pass to [`bpmn-moddle`][2]
- `callback`: callback
  - `err`: Occasional error
  - `definition`: Bpmn definition
  - `context`: Bpmn moddle context

```javascript
const Bpmn = require('bpmn-engine');

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="transformer" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <userTask id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

Bpmn.transformer.transform(processXml, {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
}, (err, def, moddleContext) => {
  const engine = new Bpmn.Engine({
    moddleContext: moddleContext
  });

  engine.execute((err, instance) => {
    if (err) throw err;

    console.log('Definition started with process', instance.mainProcess.id);
  });
});
```

## Validation

Bpmn engine exposes validation functions.

### `validateModdleContext(moddleContext)`

Validate moddle context to ensure that it is executable. Returns list of error instances, if any.

- `moddleContext`: Moddle context object

```javascript
const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="validate" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript">true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

Bpmn.transformer.transform(processXml, {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
}, (err, def, moddleContext) => {
  console.log(Bpmn.validation.validateModdleContext(moddleContext));
});
```

### `validateOptions(executeOptions)`

Validate [execution options](#executeoptions-callback) to ensure that it is correct. Throws error if invalid.

- `executeOptions`: Execution options object

[1]: https://www.npmjs.com/package/camunda-bpmn-moddle
[2]: https://www.npmjs.com/package/bpmn-moddle
