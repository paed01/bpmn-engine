Changelog
=========

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
