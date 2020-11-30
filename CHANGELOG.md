Changelog
=========

# 11.2.0

- Major bump of [`bpmn-elements@4`](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md). No apparent breaking change to engine except that gives more power to a custom script handler

# 11.1.0

- [`bpmn-elements@3.1.0`](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md)

# 11.0.0

All conditional flows from `bpmn-elements@3`.

## Breaking
- Outbound sequence flow with script condition requires `next(err, result)` to be called where result decides if it should be taken or discarded

## Addititions
- Outbound sequence flow conditions are evaluated for all activities, as well as default flow
- Process now also have `cancelActivity` function for facilitation

# 10.1.2-3

Type definitions courtesy of @saeedtabrizi.

- Some type fix and add engine broker types

# 10.1.1

- Add type definition to package.json

# 10.1.0

- Bump bpmn-elements to 2.1, adding support for Transaction and CancelEventDefinition see [change log](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md)

# 10.0.0

Untangle issue #105 which resulted in refactoring outbound sequence flow handling.

- Bump bpmn-elements from 1.6 to 2, see [change log](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md)

## Breaking
- No more `flow.pre-flight` events from sequence flows, not sure that anyone used them, but still
- Activities now publish (or emit) `activity.leave` when all outbound flows have been taken/discarded

# 9.2.0

- Bump bpmn-elements from 1.2 to 1.6, see [change log](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md)
- Support adding definition source with `addSource` function

# 9.1.1

- Bump bpmn-elements to version with ability to signal waiting start event from definition

# 9.1.0

- Bump bpmn-elements to version with shake activity functionality
- Bump moddle-context-serializer@0.16 with scripts and timers

## Additions
- Add engine option `sourceContext` to hold pre-serialized context

# 9.0.0

## Additions
- Add signal function to engine execution api

## Breaking changes
- Bump bpmn-elements to v1.0.0 with some [breaking changes](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md) regarding MessageEventDefinition and SignalEventDefinition

# 8.7.0

- Bump bpmn-moddle, bpmn-elements, and smqp to latest

# 8.6.0

- Add typescript declaration file (Saeed Tabrizi)

# 8.5.0

- Bump [bpmn-elements@0.12.1](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md#0121)

# 8.4.0

- Bump bpmn-elements@0.11.0 with new ability to use process extensions

# 8.3.0

- Bump bpmn-elements@0.9.0 to support compensation

# 8.2.1

- Bump bpmn-elements@0.8.1 that expose sequence flow name

# 8.2.0

- Bump bpmn-elements@0.8.0 and moddle-context-serializer to support StandardLoopCharacteristics

# 8.1.0

- Bump bpmn-elements@0.7.0 to support LinkEventDefinition

# 8.0.0

## Breaking changes
- Bump bpmn-elements to v0.6.0 with refactored MessageEventDefinition, ReceiveTask, and some bug fixes from @TallaInc

## Additions
- Recover takes optional options that completely overrides environment and passes it along to the recovered definitions

# 7.1.0

- Bump bpmn-elements to v0.5.0

# 7.0.0

Bump bpmn-elements and bpmn-moddle (which now has a node dist :).

## Breaking changes
- Implementation of ErrorEventDefinition is now closer to the BPMN 2.0 spec

## Additions
- Start sub-process' sub-process if sub-process throws an error
- Expose the name of the element that emitted event

# 6.2.0

## Additions
- Bump bpmn-elements and serializer and thereby add support for ConditionalEventDefinition

# 6.1.0

## Additions
- Expose humanPerformer and potentialOwner

# 6.0.0

Use [bpmn-elements](https://github.com/paed01/bpmn-elements) to execute elements.

Behind the scenes the entire definition execution is replaced with [bpmn-elements](https://github.com/paed01/bpmn-elements)

## Breaking changes
- Node version >= 10 is required
- Events are not emitted with name of the activity, i.e. no more `enter-task_a8dje7` emits
- Most events are emitted with the type of element as prefix, e.g. `activity.start`, one exception is `wait` wich is still emitted as `wait`
- `getPendingActivities()` is renamed to `getPostponed()`

## Changes
- Change license to MIT

# 5.0.0

## Breaking changes
- Engine `execute` callback is called when execution completes
- Node version >= 8.9 is supported
- `SendTask` message requires output
- `ParallelGateway` emits `start` on first taken inbound, i.e. discarded inbound are just registered
- Extensions have been moved to separate project [bpmn-engine-extensions](https://github.com/paed01/bpmn-engine-extensions)

## Additions
- Support for parallell task loop

# 4.0.0

## Breaking changes
- Parallel gateway `getState()` returns pending inbound and/or pending outbound, so old states are not supported

## Changes
- Add support for Manual task
- Support camunda input/output for Exclusive Gateways, input is passed to conditional flows
- Support camunda errorCodeVariable and errorMessageVariable for Error Events

# 3.2.0

- Add support for SendTask and ReceiveTask

# 3.1.0

## Changes
- A start event with form key will also emit wait

# 3.0.0

## Breaking changes
- The `Engine` now handles definitions instead of processes, hence:
  - `execute(callback)` returns executed definition in callback instead of process
  - `getState()` returns executing definition instead of processes
- Engine `getState()` and `resume(state)` does no longer return or need the actual definition source. They work with moddle contexts.
- `Transformer` is now called `transformer` since it is not called with `new`
- Engine instance `resume()` is now a "static" function on engine, i.e. `Engine.resume`

## Changes
- `Definition` is exposed and can be executed with moddle context and options, see [documentation](/docs/Definition.md)
- `validation` is exposed and harbours functions for validating moddle context and execute options
- Support camunda input forms for user task and start event

# 2.0.0

- Output from tasks with defined `camunda:inputOutput` now updates context variables. The previous behavior was to save result to `variables.taskInput`. That will still happen if no output is defined.

## Changes
- Support service connector (#4)
- Support map and list input/output types from modeller (#5)
