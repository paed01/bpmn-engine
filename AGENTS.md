# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

`.nvmrc` pins Node 18; `engines.node` is `>=18`. The test reporter `@bonniernews/hot-bev` and `mocha-cakes-2` UI handle parallel execution and Gherkin-style Features.

- `npm test` — runs `mocha -p` with the hot-bev reporter (parallel). `posttest` then runs `lint`, `toc` (regenerates API doc TOCs), and `dist`.
- `npm run wintest` — same suite, plain `mocha` (no `-p`/parallel; for environments where worker pools misbehave).
- `npm run lint` — eslint (cached) + prettier check.
- `npm run cov:html` / `npm run test:lcov` — coverage variants via c8.
- `npm run toc` — regenerates the table of contents in `docs/API.md` and `docs/Examples.md` via the in-repo `scripts/generate-api-toc.js` (no `markdown-toc` dep). It takes the markdown files as a comma- or space-separated argument, rewrites the block between `<!-- toc -->` and `<!-- tocstop -->`, skips the first H1 (the doc title — `docs/API.md` keeps a plain `# API Reference` title for this), and disambiguates duplicate anchors GitHub-style (`#getstate`, `#getstate-1`).
- `npm run test-md` — runs `texample` against `docs/API.md`, `docs/Examples.md`, `docs/Upgrade.md`. **Not** in the regular `posttest` chain; run manually when API doc examples change.
- `npm run dist` — rollup builds `src/index.js` → `lib/index.cjs`. The footer trick `module.exports = Object.assign(exports.default, exports)` is what lets the CJS bundle's `require('bpmn-engine')` return the `Engine` constructor _and_ expose named exports — don't remove it.
- Single test file: `npx mocha test/Engine-test.js`. Single test: append `--grep "<pattern>"`. Default mocha timeout is 1000ms (see `.mocharc.json`); feature tests under `test/feature/` use the `mocha-cakes-2` BDD UI (`Feature`/`Scenario`/`Given`/`When`/`Then`).

## Architecture

The `Engine` is a thin orchestrator on top of four heavyweights — every file in `src/` is glue:

```
bpmn-moddle (parse XML)
       │
       ▼
moddle-context-serializer  ──► persistable JSON state (serialize / deserialize)
       │
       ▼
bpmn-elements (behaviour functions: Process, Task, *EventDefinition, …)
       │
       ▼
smqp (peer dep) ── message broker driving execution
```

`src/index.js` (~630 lines) wires these together:

1. **Construction** — `Engine(options)` builds a `TypeResolver` from `bpmn-elements` + user `elements` overrides, creates an `Elements.Environment`, and instantiates a `smqp` `Broker` for engine-level events. Defaults can be passed via `Logger`, `scripts` (defaults to `JavaScripts.js` — Node `vm`-based inline script handler), `extensions`, etc.
2. **Source loading** — `addSource({ source | sourceContext })` queues sources. `source` is raw BPMN XML; `sourceContext` is a serializer output (skips XML parse). Both end up as `moddle-context-serializer` `SerializableContext`s.
3. **Execution** — `execute()` resolves all pending sources to `Definition`s (from `bpmn-elements`), starts them via the broker, and listens to broker events to surface activity status (`executing` / `timer` / `wait` / `idle`).
4. **State** — `getState()` walks each definition and pulls its serializable state; `recover(state)` reconstructs definitions; `resume()` restarts execution. As of v25, **a running engine cannot be recovered** — must be stopped first or use a fresh `Engine` instance (see CHANGELOG).

### Conventions worth knowing

- **Symbol-keyed private state.** All instance internals on `Engine`/execution use `Symbol.for('engine')`, `Symbol.for('environment')`, etc. This is the project's privacy convention — don't replace with `#fields` (would break `Object.assign`-based extension and the recover/resume state walking).
- **`getOptionsAndCallback.js`** — small helper that lets every public method accept either `(options, callback)` or `(callback)` style. Preserves the legacy callback-friendly API while the implementation returns Promises.
- **Extensions live under `src/extensions/`.** `ProcessOutputDataObject.js` is the canonical example — extensions plug into `bpmn-elements` via the engine's `extensions` option and are typically called for specific element types.
- **Test fixtures under `test/resources/`** are real `.bpmn` XML files plus a few `.json` extensions. `test/resources/JsExtension.js` and `test/resources/js-bpmn-moddle.json` define a custom moddle extension namespace used across multiple feature tests.
- **`mocha-cakes-2` ≠ standard mocha.** Files under `test/feature/` use Gherkin-flavored globals (`Feature`, `Scenario`, `Given`, `When`, `Then`, `And`, `But`). They're ESLint-allowed via the eslint config's globals.

## Build & publishing

- `type: module` in `package.json`; ESM is `src/index.js`, CJS is `lib/index.cjs` (rollup), types are hand-maintained at `types/index.d.ts` (the published `declare module 'bpmn-engine'` surface) with shared interface definitions in `types/interfaces.d.ts` (referenced by `src` JSDoc via the tsconfig `types` path).
- `prepack` runs `dist`, so `npm publish` always ships a fresh CJS bundle. `lib/index.cjs` is tracked in git — regenerate (`npm run dist`) and commit alongside source changes that affect the public API.
- Tests import via package self-reference (`import { Engine } from 'bpmn-engine'`), not `'../src/index.js'`. This exercises the same module resolution consumers use.

## Dependency notes

- **`moddle-context-serializer`** — this engine is the primary consumer that calls `.serialize()` / `deserialize()` for state persistence. The serialized JSON is a _runtime persistence format_ for live engines, so changes to it break upgrade-path for deployed engines, not just code. Keep that in mind when bumping the dep — even a "harmless" field rename in the serializer's output ripples here.
- **`bpmn-elements`** — supplies the behaviour function registry passed to `TypeResolver`. Adding new element types means adding an entry there first.
- **`smqp`** is a `peerDependency` (`>=9`) — same-maintainer message broker that drives both engine-level and definition-level event flow. Consumers install it directly. Coordinated breaking changes are feasible since the same hand maintains it.
- **`bpmn-moddle`** is a regular dep (currently `^9.0.4`). v10 changed default → named export but `src/index.js` still does `import BpmnModdle from 'bpmn-moddle'` — bumping to v10 will break the import.

## Downstream consumers

This engine is the user-facing entry point of the BPMN library stack — most application code that runs BPMN processes uses `bpmn-engine` directly, not the lower-level `bpmn-elements` / `moddle-context-serializer`. State persistence shape (the JSON returned by `getState()`) is therefore the most consumer-sensitive surface — schema changes break stored process state on upgrade.
