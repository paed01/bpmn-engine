<!-- version -->
# 9.1.1 API Reference
<!-- versionstop -->

<!-- toc -->

- [Engine](#engine)
  - [`Engine([options])`](#engineoptions)
    - [`execute([options[, callback]])`](#executeoptions-callback)
      - [Execution `listener`](#execution-listener)
      - [Execution `variables`](#execution-variables)
      - [Execution `services`](#execution-services)
    - [`getDefinitionById(id)`](#getdefinitionbyidid)
    - [`getDefinitions()`](#getdefinitions)
    - [`getState()`](#getstate)
    - [`stop()`](#stop)
    - [`recover(state[, recoverOptions])`](#recoverstate-recoveroptions)
    - [`resume([options, [callback]])`](#resumeoptions-callback)
- [Execution API](#execution-api)
  - [`getActivityById(activityId)`](#getactivitybyidactivityid)
  - [`getState()`](#getstate)
  - [`signal(message)`](#signalmessage)
- [Engine events](#engine-events)
  - [Activity events](#activity-events)
  - [Event Api](#event-api)
  - [Sequence flow events](#sequence-flow-events)
- [Expressions](#expressions)

<!-- tocstop -->

# Engine

The engine. Executes passed BPMN 2.0 definitions.

## `Engine([options])`

Creates a new Engine.

Arguments:
- `options`: Optional options, passed to [environment](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md):
  - `elements`: optional object with element type mapping override
  - `expressions`: optional expressions handler, defaults to built in [expressions](https://github.com/paed01/bpmn-elements/blob/master/docs/Expression.md)
  - `Logger`: optional [Logger factory](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md#logger), defaults to [debug](https://www.npmjs.com/package/debug) logger
  - `moddleContext`: optional BPMN 2.0 definition moddle context
  - `moddleOptions`: optional bpmn-moddle options to be passed to bpmn-moddle
  - `name`: optional name of engine,
  - `scripts`: optional [inline script handler](https://github.com/paed01/bpmn-elements/blob/master/docs/Scripts.md), defaults to nodejs vm module handling, i.e. JavaScript
  - `source`: optional BPMN 2.0 definition source as string
  - `sourceContext`: optional serialized context supplied by [moddle-context-serializer](https://github.com/paed01/moddle-context-serializer)
  - `typeResolver`: optional type resolver function passed to moddle-context-serializer

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
- `async resume()`: resume execution
- `stop()`: stop execution
- `waitFor()`: wait for engine events, returns Promise

```javascript
const {Engine} = require('bpmn-engine');
const fs = require('fs');

const engine = Engine({
  name: 'mother of all',
  source: fs.readFileSync('./test/resources/mother-of-all.bpmn'),
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});
```

### `execute([options[, callback]])`

Execute definition with:

- `options`: Optional object with options to override the initial engine options
  - [`listener`](#execution-listener): Listen for [activity events](#activity-events), an `EventEmitter` object
  - [`variables`](#execution-variables): Optional object with instance variables
  - [`services`](#execution-services): Optional object with service functions
  - `expressions`: Optional expression handling override
- `callback`: optional callback
  - `err`: Error if any
  - `execution`: Engine execution

Execute options overrides the initial options passed to the engine before executing the definition.

Returns [Execution API](#execution-api)

```javascript
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
  source,
  variables: {
    data: {
      inputFromUser: 0,
    }
  }
});

const listener = new EventEmitter();
listener.on('wait', (elementApi) => {
  elementApi.owner.logger.debug(`<${elementApi.executionId} (${elementApi.id})> signal with io`, elementApi.content.ioSpecification);
  elementApi.signal({
    ioSpecification: {
      dataOutputs: [{
        id: 'userInput',
        value: 2
      }]
    }
  });
});

engine.execute({
  listener,
  variables: {
    data: {
      inputFromUser: 1,
    }
  }
}, (err, execution) => {
  if (err) throw err;
  console.log('completed with overridden listener', execution.environment.output);
});
```

#### Execution `listener`

An `EventEmitter` object with listeners. [Event names](#activity-events) are composed by activity event name and activity id, e.g. `wait-userTask`.

```javascript
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <userTask id="userTask" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'first listener',
  source
});

const listener = new EventEmitter();
listener.on('activity.enter', (elementApi, engineApi) => {
  console.log(`${elementApi.type} <${elementApi.id}> of ${engineApi.name} is entered`);
});

listener.on('wait', (elemntApi, instance) => {
  console.log(`${elemntApi.type} <${elemntApi.id}> of ${instance.name} is waiting for input`);
  elemntApi.signal('don´t wait for me');
});

engine.execute({
  listener
});
```

#### Execution `variables`

Execution variables are passed as the first argument to `#execute`.

```javascript
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
}, (err, engineApi) => {
  if (err) throw err;
  console.log('completed');
});
```

#### Execution `services`

A service is a function exposed on `environment.services`.

```javascript
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

          get('https://example.com/test').then((body) => {
            environment.variables.scriptTaskCompleted = true;
            next(null, {result: body});
          }).catch(next)
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
  }
}, (err, engineApi) => {
  if (err) throw err;
  console.log('completed', engineApi.name, engineApi.environment.variables);
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

engine.getDefinitions().then((definitions) => {
  console.log('Loaded', definitions[0].id);
  console.log('The definition comes with process', definitions[0].getProcesses()[0].id);
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
}, (err) => {
  if (err) throw err;
});
```

### `stop()`

Stop execution. The instance is terminated.

```javascript
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
listener.once('wait', () => {
  engine.stop();
  state = engine.getState();
});

engine.execute({
  variables: {
    executionId: 'some-random-id'
  },
  listener
}, (err) => {
  if (err) throw err;
});
```

### `recover(state[, recoverOptions])`

Recover engine from state.

Arguments:
- `state`: engine state
- `recoverOptions`: optional object with options that will completely override the options passed to the engine at init

```js
const {Engine} = require('bpmn-engine');

const state = fetchSomeState();
const engine = Engine().recover(state);
```

### `resume([options, [callback]])`

Resume execution function with previously saved engine state.

```js
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const state = fetchSomeState();
const engine = Engine().recover(state);

const listener = new EventEmitter();

engine.resume({listener}, () => {
  console.log('completed');
});
```

# Execution API

- `name`: engine name
- `state`: execution state
- `stopped`: is execution stopped?
- `broker`: engine message broker
- `environment`: execution environment
- `definitions`: list of definitions
- `getActivityById(activityId)`(#getactivitybyid-activityid): get activity/element by id, returns first found among definitions
- `getState()`: get execution state
- `getPostponed()`: get postponed activities, i.e. activities waiting for some interaction or signal
- [`signal(message)`](#signalmessage): send signal to execution, distributed to all definitions
- `stop()`: stop execution
- `waitFor(event)`: wait for [engine events](#engine-events), returns Promise

## `getActivityById(activityId)`

Get activity/element by id. Loops the definitions and returns the first found activity with id.

- `activityId`: Activity or element id

Returns [activity](/paed01/bpmn-elements/blob/master/docs/Activity.md).

## `getState()`

Get execution state.

## `signal(message)`

Delegate a signal message to all interested parties, usually MessageEventDefinition, SignalEventDefinition, SignalTask (user, manual), ReceiveTask, or a StartEvent that has a form.

Arguments:
  - `message`: optional object
    - `id`: optional task/element id to signal, also matched with Message and Signal id. If not passed only anonymous Signal- and MessageEventDefinitions will pick up the signal.
    - `executionId`: optional execution id to signal, specially for looped tasks, also works for signal tasks that are not looped
    - `[name]*`: any other properties will be forwarded as message to activity

# Engine events

Engine emits the following events:

- `error`: An non-recoverable error has occurred
- `end`: Execution completed

## Activity events

Each activity and flow emits events when changing state.

- `activity.enter`: An activity is entered
- `activity.start`: An activity is started
- `activity.wait`: The activity is postponed for some reason, e.g. a user task is waiting to be signaled or a message is expected
- `activity.end`: An activity has ended successfully
- `activity.leave`: The execution left the activity
- `activity.stop`: Activity run was stopped
- `activity.throw`: An recoverable error was thrown
- `activity.error`: An non-recoverable error has occurred

## Event Api

Events are emitted with api with execution properties

- `name`: engine name
- `state`: state of execution, i.e running or idle
- `stopped`: is the execution stopped
- `environment`: engine environment
- `definitions`: executing definitions
- `stop()`: stop execution
- `getState()`: get execution serializable state
- `getPostponed()`: get activities in a postponed state

## Sequence flow events

- `flow.take`: The sequence flow was taken
- `flow.discard`: The sequence flow was discarded
- `flow.looped`: The sequence is looped

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
