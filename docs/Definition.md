Definition
==========

Executable BPMN 2 definition. Pass moddle context and execute.

<!-- toc -->

- [API](#api)
  - [`new Definition(moddleContext[, options])`](#new-definitionmoddlecontext-options)
    - [`execute([options[, callback]])`](#executeoptions-callback)
    - [`getChildActivityById(id)`](#getchildactivitybyidid)
    - [`getPendingActivities()`](#getpendingactivities)
    - [`getProcesses([options[, callback]])`](#getprocessesoptions-callback)
    - [`getState()`](#getstate)
    - [`signal(activityId[, message])`](#signalactivityid-message)
    - [`stop()`](#stop)
  - [`Definition.resume(definitionState[, options[, callback]])`](#definitionresumedefinitionstate-options-callback)
- [Events](#events)
  - [`start`](#start)
  - [`end`](#end)
  - [`error`](#error)

<!-- tocstop -->

# API

## `new Definition(moddleContext[, options])`

Definition constructor.

- `moddleContext`: Moddle context from [bpmn-moddle][2]
- `options`: Optional execute options
  - [`variables`](/API.md#execution-variables)
  - [`services`](/API.md#execution-services)
  - [`listener`](/API.md#execution-listener)

### `execute([options[, callback]])`

- `options`: Optional execute options, defaults to constructor options
  - [`variables`](/API.md#execution-variables)
  - [`services`](/API.md#execution-services)
  - [`listener`](/API.md#execution-listener)
- `callback`: Optional callback
  - `err`: Occasional error
  - `mainProcess`: Executing process
  - `processes`: All processes including executable process

### `getChildActivityById(id)`

Get process activity by id. Loops processes to return first child activity that match id.

### `getPendingActivities()`

Get activities that are in an entered state.

- `state`: State of definition
- `children`: List of children that are in an entered state
  - `id`: child id
  - `entered`: Boolean indicating that the child is currently executing
  - `waiting`: Boolean indicating if the task is in a waiting state

### `getProcesses([options[, callback]])`

Returns list of definiton processes with options. If the definition is running the running processes are returned.

The function is synchronous but can be passed a callback to get the first executable process.

- `options`: Optional execute options, defaults to constructor options if processes arn't started
  - `variables`
  - `services`
  - `listener`
- `callback`: Optional callback
  - `err`: Occasional error
  - `mainProcess`: First executable process
  - `processes`: All processes including executable process

### `getState()`

Get definition state.

- `state`: State of definition, `pending`, `running`, or `completed`
- `stopped`: Boolean indicating that the definition was stopped before state was accuired
- `moddleContext`: Definition moddle context
- `processes`: Object with processes with id as key
  - `variables`: Execution variables
  - `services`: Execution services
  - `children`: List of child states
    - `entered`: Boolean indicating if the child is currently executing

### `signal(activityId[, message])`

Signal an activity that is waiting.

- `activityId`: Activity Id
- `message`: Activity input message

Returns boolean, `true` if signal was approved and `false` otherwise.

### `stop()`

Stop execution.

## `Definition.resume(definitionState[, options[, callback]])`

Resume execution. Resumed with data from [`getState()`](#getstate).

Returns resumed definition.

- `definitionState`: Required definition state from [`getState()`](#getstate)
- `options`: Optional execute options
  - `listener`: [Execution listener](/API.md#execution-listener)
- `callback`: Optional callback
  - `err`: Occasional error
  - `mainProcess`: Executing process
  - `processes`: All processes including executing process

# Events

Emitted events.

## `start`

Definition started execution but not yet any processes.

## `end`

All processes have completed.

## `error`

A non-recoverable error has ocurred.

Arguments:
- `err`: The error
- `eventSource`: The source instance that emitted error, e.g. a task or other activitiy

[2]: https://www.npmjs.com/package/bpmn-moddle
