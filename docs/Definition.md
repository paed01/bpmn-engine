Definition
==========

Base of all bpmn activity types.

<!-- toc -->

- [API](#api)
  - [`new Definition(moddleContext[, options])`](#new-definitionmoddlecontext-options)
  - [`execute([options[, callback]])`](#executeoptions-callback)
  - [`getProcesses([options[, callback]])`](#getprocessesoptions-callback)
  - [`getChildActivityById(id)`](#getchildactivitybyidid)
  - [`stop()`](#stop)
  - [`getState()`](#getstate)
  - [`resume(definitionState)`](#resumedefinitionstate)
- [Events](#events)
  - [`start`](#start)
  - [`end`](#end)
  - [`error`](#error)

<!-- tocstop -->

# API

## `new Definition(moddleContext[, options])`

Definition constructor.

- `moddleContext`: Moddle context
- `options`: Optional execute options
  - `variables`
  - `services`
  - `listener`

## `execute([options[, callback]])`

- `options`: Optional execute options, defaults to constructor options
  - `variables`
  - `services`
  - `listener`
- `callback`: Optional callback
  - `err`: Occasional error
  - `mainProcess`: Executing process
  - `processes`: All processes including executable process

## `getProcesses([options[, callback]])`

Get process(es) from passed moddle context. If the definition has status running the running processes are returned.

- `options`: Optional execute options, defaults to constructor options
  - `variables`
  - `services`
  - `listener`
- `callback`: Optional callback
  - `err`: Occasional error
  - `mainProcess`: Executable process
  - `processes`: All processes including executable process

## `getChildActivityById(id)`

Get process actitivy by id. Loops processes to return first child activity with id.

## `stop()`

Stop execution.

## `getState()`

Get activity state.

- `id`: Activity id
- `type`: Activity type
- `entered`: The activity is entered, i.e. in a running state

## `resume(definitionState)`

Resume execution. Resumed with data from [`getState()`](#getstate).

# Events

## `start`
## `end`
## `error`
