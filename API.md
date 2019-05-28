<!-- version -->
# 6.0.0 API Reference
<!-- versionstop -->

<!-- toc -->

- [Engine](#engine)
  - [`Engine([options])`](#engineoptions)
    - [`execute([options[, callback]])`](#executeoptions-callback)
      - [Execution `listener`](#execution-listener)
      - [Execution `variables`](#execution-variables)
      - [Execution `services`](#execution-services)
    - [`getDefinition(callback)`](#getdefinitioncallback)
    - [`getDefinitions(callback)`](#getdefinitionscallback)
    - [`getPostponed()`](#getpostponed)
    - [`getState()`](#getstate)
    - [`stop()`](#stop)
  - [`resume(state, [options, [callback]])`](#resumestate-options-callback)
  - [Engine events](#engine-events)
  - [Activity events](#activity-events)
  - [Sequence flow events](#sequence-flow-events)
- [Expressions](#expressions)

<!-- tocstop -->

# Engine

The engine. Executes passed BPMN definitions.

## `Engine([options])`

Creates a new Engine.

Arguments:
- `options`: Optional options, passed to [environment](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md):
  - `name`: optional name of engine,
  - `source`: BPMN 2.0 definition source as string
  - `moddleOptions`: optional bpmn-moddle options
  - `moddleContext`: optional BPMN 2.0 definition moddle context
  - `scripts`: optional [inline script handler](https://github.com/paed01/bpmn-elements/blob/master/docs/Scripts.md), defaults to vm module handling, i.e. JavaScript
  - `Logger`: optional [Logger factory](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md#logger), defaults to [debug](https://www.npmjs.com/package/debug) logger

Returns:
- `name`: engine name
- `broker`: engine [broker](https://github.com/paed01/smqp)
- `state`: engine state
- `stopped`: boolean stopped
- `execution`: current engine execution
- `environment`: engine environment
- `logger`: engine logger
- `async execute()`: execute definition
- `async getDefinitionById()`: get definition by id
- `async getDefinitions()`: get all definitions
- `async getState()`: get execution serialized state
- `recover()`: recover from state
- `async resume()`:
- `stop()`: stop execution
- `waitFor()`: wait for engine events, returns Promise

```javascript
const {Engine} = require('bpmn-engine');
const fs = require('fs');

const engine = Engine({
  name: 'mother of all',
  source: fs.readFileSync('./test/resources/mother-of-all.bpmn'),
  moddleOptions: require('camunda-bpmn-moddle/resources/camunda')
});
```

### `execute([options[, callback]])`

Execute definition with:

- `options`: Optional object
  - [`listener`](#execution-listener): Listen for [activity events](#activity-events), an `EventEmitter` object
  - [`variables`](#execution-variables): Optional object with instance variables
  - [`services`](#execution-services): Optional object with service definitions
- `callback`: optional callback
  - `err`: Error if any
  - `execution`: Engine execution

```javascript
'use strict';

const {Engine} = require('bpmn-engine');

const source = `
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

const engine = Engine({
  name: 'first',
  source
});

engine.execute((err, definition) => {
  if (err) throw err;
  console.log('completed')
});
```

#### Execution `listener`

An `EventEmitter` object with listeners. [Event names](#activity-events) are composed by activity event name and activity id, e.g. `wait-userTask`.

```js
const {EventEmitter} = require('events');

const listener = new EventEmitter();

listener.on('wait', (task, instance) => {
  console.log(`${task.type} <${task.id}> of ${instance.id} is waiting for input`);
  task.signal('don´t wait for me');
});

engine.execute({
  listener
})
```

A generic event is also emitted, i.e. only the [event](#activity-events) is emitted.

```js
listener.on('activity.enter', (activity, instance) => {
  console.log(`${activity.type} <${activity.id}> of ${instance.id} is entered`);
});
```

Event arguments are:

- `activity`: The activity
- `instance`: The running process instance

> NB! `error` events are NOT emitted through the listener. Errors can be caught by an bpmn error event if they are to be handled.

#### Execution `variables`

Execution variables are passed as the first argument to `#execute`.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const fs = require('fs');

const engine = Engine({
  name: 'using variables',
  source: fs.readFileSync('./test/resources/simple-task.bpmn')
});

const variables = {
  input: 1
};

engine.execute({
  variables
}, (err, instance) => {
  if (err) throw err;
  console.log('completed')
});
```

#### Execution `services`

A service is a function exposed on `environment.services`.

```javascript
const bent = require('bent');

const options = {
  services: {
    get: bent('json'),
  }
};
```


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
          const get = environment.services.get;

          const self = this;

          get('http://example.com/test').then((resp) => {
            environment.variables.scriptTaskCompleted = true;
            next(null, {result: body});
          }).catch((err) => next)
        ]]>
      </script>
    </scriptTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
    <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'services doc',
  source
});

engine.execute({
  services: {
    get: bent('json')
  },
  checkState: (message) => {
    return message.variables.statusCode === 200;
  }
}, (err, instance) => {
  if (err) throw err;
  console.log('completed', instance.name)
});
```

### `getDefinitionById(id)`

Get definition by id, returns Promise

### `getDefinitions()`

Get all definitions

```javascript
const {Engine} = require('bpmn-engine');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="Definition_42" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <userTask id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = Engine({
  source
});

engine.getDefinitions((err, definitions) => {
  if (err) throw err;

  console.log('Loaded', definitions[0].id);

  console.log('The definition comes with process', definitions[0].getProcesses()[0].id);
});
```

### `getPostponed()`

Get activities that are in a postponed state.

- `state`: State of engine
- `definitions`: List of definitions
  - `state`: State of definition
  - `children`: List of children that are in an entered state
    - `id`: child id
    - `entered`: Boolean indicating that the child is currently executing
    - `waiting`: Boolean indicating if the task is in a waiting state

```js
'use strict';

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');
const camundaExt = require('bpmn-engine-extensions/resources/camunda');

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
  extensions: {
    camunda: camundaExt
  }
});

const listener = new EventEmitter();

listener.on('wait', (api) => {
  const pending = engine.getPostponed();
  console.log('PENDING', JSON.stringify(pending, null, 2));

  if (api.form) {
    api.form.getFields()[0].set("mememe");
  }

  engine.signal(api.id);
});

engine.execute({
  listener
});
```

### `getState()`

Get state of a running execution. Listener events `wait` and `start` are recommended when saving state.

The saved state will include the following content:

- `state`: `running` or `idle`
- `engineVersion`: module package version
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

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');
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

const engine = Engine({
  source: processXml
});

const listener = new EventEmitter();

let state;
listener.once('wait-userTask', () => {
  state = engine.getState();
  fs.writeFileSync('./tmp/some-random-id.json', JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
});

listener.once('start', () => {
  state = engine.getState();
  fs.writeFileSync('./tmp/some-random-id.json', JSON.stringify(state, null, 2));
});

engine.execute({
  listener
}, (err, execution) => {
  if (err) throw err;
});
```

### `stop()`

Stop execution. The instance is terminated.

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
  source
});
const listener = new EventEmitter();

let state;
listener.once('wait', (activity) => {
  engine.stop();
  state = engine.getState();
});

engine.execute({
  variables: {
    executionId: 'some-random-id'
  },
  listener
}, (err, execution) => {
  if (err) throw err;
});
```

## `resume(state, [options, [callback]])`

Resume execution function with previously saved engine state.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

// Retrieve saved state
const state = db.getSavedState('some-random-id', (err, state) => {
  if (err) return console.log(err.message);

  console.log(state)

  const listener = new EventEmitter();
  listener.on('wait', (api) => {
    api.signal();
  });

  const engine = Engine.resume(state, {listener});
  engine.on('end', () => {
    console.log('resumed instance completed');
  });
  engine.on('error', (err) => {
    console.error('failed with', err);
  });
});
```

## Engine events

Engine emits the following events:

- `error`: An non-recoverable error has occurred
- `end`: Execution has completed or was stopped

## Activity events

Each activity and flow emits events when changing state.

- `activity.enter`: An activity is entered
- `activity.start`: An activity is started
- `activity.wait`: An event or user task waits for signal
- `activity.end`: A task has ended successfully
- `activity.cancel`: An activity execution was canceled
- `activity.leave`: The execution left the activity
- `activity.stop`: Activity run was stopped
- `activity.error`: An non-recoverable error has occurred

## Sequence flow events

- `flow.take`: The sequence flow was taken
- `flow.discard`: The sequence flow was discarded

# Expressions

Expressions come in the form of `${<variables or services>.<property name>}`.

The following expressions are supported:

- `${variables.input}` - resolves to the variable input
- `${variables.input[0]}` - resolves to first item of the variable input array
- `${variables.input[-1]}` - resolves to last item of the variable input array
- `${variables.input[spaced name]}` - resolves to the variable input object property `spaced name`

- `${services.getInput}` - return the service function `getInput`
- `${services.getInput()}` - executes the service function `getInput` with the argument `{services, variables}`
- `${services.isBelow(variables.input,2)}` - executes the service function `isBelow` with result of `variable.input` value and 2

and, as utility:

- `${true}` - return Boolean value `true`
- `${false}` - return Boolean value `false`

Expressions are supported by many elements, e.g.:
- MultiInstanceLoopCharacteristics
  - `camunda:collection`: variable collection, e.g. `${variables.list}`
- ServiceTask
  - `camunda:expression` element value. moddleOptions [`require('camunda-bpmn-moddle/resources/camunda')`][1] must be used.
- SequenceFlow
  - `conditionExpression` element value
- TimerEvent
  - `timeDuration` element value

Expressions in expressions is **not** supported.

[1]: https://www.npmjs.com/package/camunda-bpmn-moddle
[2]: https://www.npmjs.com/package/bpmn-moddle
