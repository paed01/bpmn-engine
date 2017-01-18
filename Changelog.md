Changelog
=========

# 2.0.0

## Breaking changes
- The `Engine` now handles definitions instead of processes, hence:
  - `execute(callback)` returns executed definition in callback instead of process
  - `getState()` returns executing definition instead of processes
- Engine `getState()` and `resume(state)` does no longer return or need the actual definition source. They work with moddle contexts.
- `Transformer` is now called `transformer` since it is not called with `new`

## Additions
- `Definition` is exposed and can be executed with moddle context and options, see [documentation](/docs/Definition.md)
- `validation` is exposed and harbours functions for validating moddle context and execute options
