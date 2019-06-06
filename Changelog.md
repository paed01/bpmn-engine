Changelog
=========

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
