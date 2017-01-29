Changelog
=========

# 2.0.0

## Breaking changes
- Output from tasks with defined `camunda:inputOutput` now updates context variables. The previous behavior was to save result to `variables.taskInput`. That will still happen if no output is defined.

## Changes
- Support service connector (#4)
- Support map and list input/output types from modeller (#5)
