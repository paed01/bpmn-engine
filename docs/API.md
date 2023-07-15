<!-- version -->
# 17.1.1 API Reference
<!-- versionstop -->

<!-- toc -->

- [Engine](#engine)
  - [`new Engine([options])`](#new-engineoptions)
    - [`execute([options[, callback]])`](#executeoptions-callback)
      - [Execution `listener`](#execution-listener)
      - [Execution `variables`](#execution-variables)
      - [Execution `services`](#execution-services)
    - [`async getDefinitionById(id)`](#async-getdefinitionbyidid)
    - [`addSource({sourceContext})`](#addsourcesourcecontext)
    - [`getDefinitions()`](#getdefinitions)
    - [`getState()`](#getstate)
    - [`stop()`](#stop)
    - [`recover(state[, recoverOptions])`](#recoverstate-recoveroptions)
    - [`resume([options, [callback]])`](#resumeoptions-callback)
- [Execution API](#execution-api)
  - [`getActivityById(activityId)`](#getactivitybyidactivityid)
  - [`getState()`](#getstate)
  - [`signal(message[, options])`](#signalmessage-options)
  - [`cancelActivity(message)`](#cancelactivitymessage)
- [Engine events](#engine-events)
  - [Activity events](#activity-events)
  - [Event Api](#event-api)
  - [Sequence flow events](#sequence-flow-events)
- [Expressions](#expressions)

<!-- tocstop -->

# Engine

The engine. Executes passed BPMN 2.0 definitions.

## `new Engine([options])`

Creates a new Engine.

Arguments:
- `options`: Optional options, passed to [environment](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md):
  - `disableDummyScript`: optional boolean to disable dummy script supplied to empty ScriptTask
  - `elements`: optional object with element type mapping override
  - `expressions`: optional override [expressions](#expressions) handler
  - `extendFn`: optional extend [serializer](https://github.com/paed01/moddle-context-serializer/blob/master/API.md) function
  - `Logger`: optional [Logger factory](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md#logger), defaults to [debug](https://www.npmjs.com/package/debug) logger
  - `moddleContext`: optional BPMN 2.0 definition moddle context
  - `moddleOptions`: optional bpmn-moddle options to be passed to bpmn-moddle
  - `name`: optional name of engine,
  - `scripts`: optional [inline script handler](https://github.com/paed01/bpmn-elements/blob/master/docs/Scripts.md), defaults to nodejs vm module handling, i.e. JavaScript
  - `source`: optional BPMN 2.0 definition source as string
  - `sourceContext`: optional serialized context supplied by [moddle-context-serializer](https://github.com/paed01/moddle-context-serializer)
  - `timers`: [Timers instance](https://github.com/paed01/bpmn-elements/blob/master/docs/Timers.md)
  - `typeResolver`: optional type resolver function passed to moddle-context-serializer
  - `extensions`: optional behavior [extensions](https://github.com/paed01/bpmn-elements/blob/master/docs/Extension.md)

Returns:
- `name`: engine name
- `broker`: engine [broker](https://github.com/paed01/smqp)
- `state`: engine state
- `activityStatus`: string, activity status
  * `executing`: at least one activity is executing, e.g. a service task making a asynchronous request
  * `timer`: at least one activity is waiting for a timer to complete, usually only TimerEventDefinition's
  * `wait`: at least one activity is waiting for a signal of some sort, e.g. user tasks, intermediate catch events, etc
  * `idle`: idle, no activities are running
- `stopped`: boolean stopped
- `execution`: current engine execution
- `environment`: engine [environment](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md)
- `logger`: engine logger
- `async execute()`: execute definition
- `async getDefinitionById()`: get definition by id
- `async getDefinitions()`: get all definitions
- `async getState()`: get execution serialized state
- `recover()`: recover from state
- `async resume()`: resume execution
- `async stop()`: stop execution
- `waitFor()`: wait for engine events, returns Promise

```javascript
const {Engine} = require('bpmn-engine');
const fs = require('fs');

const engine = new Engine({
  name: 'mother of all',
  source: fs.readFileSync('./test/resources/mother-of-all.bpmn'),
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});
```

### `execute([options[, callback]])`

Execute definition.

Arguments:
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

const engine = new Engine({
  name: 'first',
  source,
  variables: {
    data: {
      inputFromUser: 0,
    }
  }
});

const listener = new EventEmitter();
listener.on('activity.wait', (elementApi) => {
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

An `EventEmitter` object with listeners. Listen for [activity events](#activity-events).

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

const engine = new Engine({
  name: 'first listener',
  source
});

const listener = new EventEmitter();
listener.on('activity.enter', (elementApi, engineApi) => {
  console.log(`${elementApi.type} <${elementApi.id}> of ${engineApi.name} is entered`);
});

listener.on('activity.wait', (elemntApi, instance) => {
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

const engine = new Engine({
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

const engine = new Engine({
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

### `async getDefinitionById(id)`

Get definition by id, returns Promise

### `addSource({sourceContext})`

Add definition source by source context.

Arguments:
- `source`: object
  - `sourceContext`: serializable source

```javascript
const BpmnModdle = require('bpmn-moddle');
const elements = require('bpmn-elements');
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');
const {default: serializer, TypeResolver} = require('moddle-context-serializer');

const engine = new Engine({
  name: 'add source',
});

(async function IIFE(source) {
  const sourceContext = await getContext(source);
  engine.addSource({
    sourceContext,
  });

  const listener = new EventEmitter();
  listener.once('activity.wait', (api) => {
    console.log(api.name, 'is waiting');
    api.signal();
  });

  await engine.execute({
    listener
  });

  await engine.waitFor('end');
})(`
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <userTask id="task" name="lazy source user" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
    <endEvent id="end" />
  </process>
</definitions>
`);

async function getContext(source, options = {}) {
  const moddleContext = await getModdleContext(source, options);

  if (moddleContext.warnings) {
    moddleContext.warnings.forEach(({error, message, element, property}) => {
      if (error) return console.error(message);
      console.error(`<${element.id}> ${property}:`, message);
    });
  }

  const types = TypeResolver({
    ...elements,
    ...options.elements,
  });

  return serializer(moddleContext, types, options.extendFn);
}

function getModdleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);
  return bpmnModdle.fromXML(source);
}
```

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

const engine = new Engine({
  source
});

engine.getDefinitions().then((definitions) => {
  console.log('Loaded', definitions[0].id);
  console.log('The definition comes with process', definitions[0].getProcesses()[0].id);
});
```

### `getState()`

Asynchronous function to get state of a running execution.

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
const {promises: fs} = require('fs');

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <userTask id="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
    <endEvent id="theEnd" />
  </process>
</definitions>`;

const engine = new Engine({
  source: processXml
});

const listener = new EventEmitter();

let state;
listener.once('activity.wait', async () => {
  state = await engine.getState();
  await fs.writeFile('./tmp/some-random-id.json', JSON.stringify(state, null, 2));
});

listener.once('activity.start', async () => {
  state = await engine.getState();
  await fs.writeFile('./tmp/some-random-id.json', JSON.stringify(state, null, 2));
});

engine.execute({
  listener
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

const engine = new Engine({
  source
});
const listener = new EventEmitter();

let state;
listener.once('activity.wait', async () => {
  engine.stop();
  state = await engine.getState();
});

engine.execute({
  variables: {
    executionId: 'some-random-id'
  },
  listener
});
```

### `recover(state[, recoverOptions])`

Recover engine from state.

Arguments:
- `state`: engine state
- `recoverOptions`: optional object with options that will override options passed to the engine at init, but not options recovered from state

```js
const {Engine} = require('bpmn-engine');

const state = fetchSomeState();
const engine = new Engine().recover(state);
```

### `resume([options, [callback]])`

Resume execution function with previously saved engine state.

Arguments:
- `options`: optional resume options object
  - [`listener`](#execution-listener): execution listener
- `callback`: optional callback
  - `err`: Error if any
  - `execution`: Resumed engine execution


```js
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const state = fetchSomeState();
const engine = new Engine().recover(state);

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
- `activityStatus`: string, execution activity status
  * `executing`: at least one activity is executing, e.g. a service task making a asynchronous request
  * `timer`: at least one activity is waiting for a timer to complete, usually only TimerEventDefinition's
  * `wait`: at least one activity is waiting for a signal of some sort, e.g. user tasks, intermediate catch events, etc
  * `idle`: idle, no activities are running
- `getActivityById(activityId)`(#getactivitybyid-activityid): get activity/element by id, returns first found among definitions
- `getState()`: get execution state
- `getPostponed()`: get postponed activities, i.e. activities waiting for some interaction, signal, or timer
- [`signal(message)`](#signalmessage): send signal to execution, distributed to all definitions
- [`cancelActivity(message)`](#cancelactivitymessage): send cancel activity to execution, distributed to all definitions
- `stop()`: stop execution
- `waitFor(event)`: wait for [engine events](#engine-events), returns Promise

## `getActivityById(activityId)`

Get activity/element by id. Loops the definitions and returns the first found activity with id.

- `activityId`: Activity or element id

Returns [activity](https://github.com/paed01/bpmn-elements/blob/master/docs/Activity.md).

## `getState()`

Get execution state.

## `signal(message[, options])`

Delegate a signal message to all interested parties, usually MessageEventDefinition, SignalEventDefinition, SignalTask (user, manual), ReceiveTask, or a StartEvent that has a form.

Arguments:
- `message`: optional object
  - `id`: optional task/element id to signal, also matched with Message and Signal id. If not passed only anonymous Signal- and MessageEventDefinitions will pick up the signal.
  - `executionId`: optional execution id to signal, specially for looped tasks, also works for signal tasks that are not looped
  - `[name]*`: any other properties will be forwarded as message to activity
- options: optional options object
  - `ignoreSameDefinition`: boolean, ignore same definition, used when a signal is forwarded from another definition execution, see example

An example on how to setup signal forwarding between definitions:
```js
engine.broker.subscribeTmp('event', 'activity.signal', (routingKey, msg) => {
  engine.execution.signal(msg.content.message, {ignoreSameDefinition: true});
}, {noAck: true});
```

## `cancelActivity(message)`

Delegate a cancel message to all interested parties, perhaps a stalled TimerEventDefinition.

Arguments:
- `message`: optional object
  - `id`: optional activity id to cancel execution
  - `executionId`: optional execution id to signal, useful for an event with multiple event defintions
  - `[name]*`: any other properties will be forwarded as message to activity

# Engine events

Engine emits the following events:

- `error`: An non-recoverable error has occurred
- `stop`: Executions was stopped
- `end`: Execution completed

## Activity events

Each activity and flow emits events when changing state.

- `activity.enter`: An activity is entered
- `activity.start`: An activity is started
- `activity.wait`: The activity is postponed for some reason, e.g. a user task is waiting to be signaled or a message is expected
- `wait`: Same as above
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

If not overridden [bpmn-elements](https://github.com/paed01/bpmn-elements/blob/master/docs/Expression.md) expressions handler is used.

Try out [`aircall-expression-parser`](https://github.com/aircall/aircall-expression-parser) by [Aircall](https://github.com/aircall) if you expect advanced expressions with operators.

[1]: https://www.npmjs.com/package/camunda-bpmn-moddle
[2]: https://www.npmjs.com/package/bpmn-moddle
