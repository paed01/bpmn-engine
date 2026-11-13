# Upgrade

<!-- toc -->

- [v26 → v27](#v26--v27)
  - [Node 22 is required](#node-22-is-required)
  - [No CommonJS build](#no-commonjs-build)
  - [bpmn-moddle 10 is required](#bpmn-moddle-10-is-required)
- [v25 → v26](#v25--v26)
  - [Peer dependencies](#peer-dependencies)
  - [Sequence flows are no longer discarded](#sequence-flows-are-no-longer-discarded)
  - [Resuming state saved by v25](#resuming-state-saved-by-v25)
  - [Types](#types)
- [< v14](#-v14)

<!-- /toc -->

# v26 → v27

Version 27 drops support for node 18 and 20 and with them the bundled CommonJS build: the package is published as ES modules only. It also requires `bpmn-moddle` 10. Execution behaviour, api, and persisted state are unchanged, so a host that imports the engine on node 22 or later with `bpmn-moddle` 10 installed upgrades without changes.

## Node 22 is required

Node 18 and 20 are no longer supported or tested. The package declares `engines.node` as `>=22`, so installing on an older version warns or fails, depending on the package manager and its engine settings.

## No CommonJS build

The `lib` folder with the bundled CommonJS build is no longer published. Package `main` and `exports` resolve to the ES module source in `src`, for `import` and `require` alike.

A CommonJS host keeps its `require` call, node loads the ES module natively. What it returns has changed: `require('bpmn-engine')` is the module namespace, no longer the `Engine` constructor with the named exports attached to it. Pick the named export:

```js
// v26 and v27
const { Engine } = require('bpmn-engine');

// v26 only, in v27 the constructor is found under `default`
const Engine = require('bpmn-engine');
```

Things to look out for:

- requiring an ES module works without flags from node 22.12. Node 22.0 through 22.11 need `--experimental-require-module`, or a switch to `import`.
- tooling that brings its own CommonJS loader instead of using node's — some test runners and bundlers — is now served ES module source and must be set up to load or transform it.
- anything that points at `lib/index.cjs` by path, e.g. a bundler alias, must point at `src/index.js`.
- `require` and `import` now share one module instance. A host mixing the two no longer loads two copies of the engine.

## bpmn-moddle 10 is required

The `bpmn-moddle` peer dependency range is `>=10`, and the engine no longer loads with `bpmn-moddle` 9 installed. If the engine parses the XML through the `source` option, installing `bpmn-moddle` 10 is enough. If you parse it yourself, the parser is a named export since 10:

```js
// bpmn-moddle 9
import BpmnModdle from 'bpmn-moddle';

// bpmn-moddle 10
import { BpmnModdle } from 'bpmn-moddle';
```

State saved while running on `bpmn-moddle` 9 is recovered and resumed as is, see [bpmn-moddle 9 → 10](/docs/bpmn-moddle.md).

A TypeScript host that passes the `moddleContext` option should know that it is now declared as `BPMNModel`, what `fromXML()` resolves to, instead of `Definitions`.

# v25 → v26

Version 26 runs on [`bpmn-elements@18`](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md), which refactors parallel gateway convergence and removes sequence flow discards altogether. Most diagrams run unchanged, but the behavioural changes are in the elements, not the engine, so read the [bpmn-elements upgrade guide](https://github.com/paed01/bpmn-elements/blob/master/docs/Upgrade.md) first. What follows is what changes from the engine's point of view.

## Peer dependencies

`bpmn-elements`, `bpmn-moddle`, `moddle-context-serializer`, `smqp`, and `debug` are peer dependencies. Install and pin them yourself, see [peer dependencies](/README.md#peer-dependencies) for the supported ranges. `smqp@15` or later is required.

`bpmn-moddle` 9 and 10 are both supported — see [bpmn-moddle 9 → 10](/docs/bpmn-moddle.md) for the import change.

## Sequence flows are no longer discarded

An untaken branch is left untouched instead of propagating a chain of discards. For an engine host this means:

- the `flow.discard` and `flow.looped` events are never emitted, so the `listener` and `engine.broker` only see `flow.take`. The `BpmnSequenceFlowEvent` type reflects this.
- `discarded` counters on sequence flows and downstream activities stay at `0` for untaken branches. Track `flow.take` and `activity.end` instead. An activity discarded through the api still increments its own counter.
- multiple start events in a process are mutually exclusive entry points, an `IntermediateCatchEvent` without inbound flows is no longer started by default, and starting activities that are not start events are no longer auto-discarded. Diagrams relying on any of these must be redesigned.

The details, including converging parallel gateways and shake output, are in the [bpmn-elements upgrade guide](https://github.com/paed01/bpmn-elements/blob/master/docs/Upgrade.md#no-more-flow-discards).

## Resuming state saved by v25

State saved by v25 can be recovered and resumed by v26. `bpmn-elements@18` stamps definition state with a `stateVersion` and migrates older state on resume: start events are reconciled to the mutually exclusive rule and stale discard tokens left on process queues are acked, so they no longer strand process completion. No action is required beyond resuming; saving again stamps the current version. See [resuming state saved by v17](https://github.com/paed01/bpmn-elements/blob/master/docs/Upgrade.md#resuming-state-saved-by-v17).

## Types

The engine ships hand-maintained TypeScript declarations. Recompile a TypeScript host against them:

- `Execution` requires `new`
- `BpmnSequenceFlowEvent` is `flow.take` only, and `wait` is removed from `BpmnEngineEvent` since the engine never emits it
- `BpmnActivityEvent` covers `activity.timer`, `activity.timeout`, `activity.signal`, `activity.catch`, `activity.discard`, and `activity.cancel`, and `BpmnProcessEvent`, `BpmnDefinitionEvent`, and `BpmnListenerEvent` are new
- the `typeResolver` option is a type resolver extender function, `JavaScripts` is callable without `new`, and `getScript` may return undefined

# < v14

Since v14 of the engine output is no longer shared between definition and processes. To upgrade a saved state before version 14 you can run the following script that adds process environment to state.

```javascript
export function upgradeStateToVersion14(state) {
  const stateVersion = getSemverVersion(state.engineVersion);
  if (!stateVersion || stateVersion.major >= 14) return state;

  return polyfillProcessEnvironment(state);
}

function polyfillProcessEnvironment(state) {
  if (!state.definitions?.length) return state;

  const polyfilledState = JSON.parse(JSON.stringify(state));
  for (const definition of polyfilledState.definitions) {
    if (!definition.environment) continue;
    if (!definition.execution) continue;
    if (!definition.execution.processes) continue;

    for (const bp of definition.execution.processes) {
      addProcessEnvironment(definition.environment, bp);
    }
  }

  return polyfilledState;
}

function addProcessEnvironment(environment, processState) {
  processState.environment = JSON.parse(JSON.stringify(environment));
}

function getSemverVersion(version) {
  if (typeof version !== 'string') return;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return;
  const [, major, minor, patch] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}
```
