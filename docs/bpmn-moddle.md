# bpmn-moddle 9 vs 10

`bpmn-engine` declares [`bpmn-moddle`](https://github.com/bpmn-io/bpmn-moddle) as a **peer dependency** with the range `>=9`. You install it yourself and you are free to run the engine on either the 9.x or 10.x line:

```sh
npm install bpmn-engine bpmn-moddle smqp
```

The engine uses `bpmn-moddle` only to parse BPMN XML into a moddle context (`new BpmnModdle().fromXML(source)`). The moddle context is then handed to [`moddle-context-serializer`](https://github.com/paed01/moddle-context-serializer) to produce the persistable source context. Everything downstream of the parse — execution, `getState()`, `recover()`, `resume()` — is independent of the `bpmn-moddle` version.

## What changed in 10

The output of `fromXML()` is unchanged between 9 and 10 — same `{ rootElement, elementsById, references, warnings }` shape, same element ids and references. The breaking change is purely how the package is consumed:

|               | bpmn-moddle 9                          | bpmn-moddle 10                             |
| ------------- | -------------------------------------- | ------------------------------------------ |
| Module entry  | CommonJS                               | ESM (`type: module`)                       |
| Parser export | **default** export                     | **named** export `BpmnModdle`              |
| Import        | `import BpmnModdle from 'bpmn-moddle'` | `import { BpmnModdle } from 'bpmn-moddle'` |
| `require()`   | `require('bpmn-moddle')`               | not available (ESM only)                   |

```js
// bpmn-moddle 9
import BpmnModdle from 'bpmn-moddle';

// bpmn-moddle 10
import { BpmnModdle } from 'bpmn-moddle';
```

`bpmn-engine` resolves whichever export shape the installed version provides, so the `source` option — where the engine parses the XML for you — works on both lines. No code changes are needed to move between 9 and 10.

One caveat for CommonJS consumers (`require('bpmn-engine')`): bpmn-moddle 10 is ESM-only, so the engine's CJS bundle reaches it through Node's `require(esm)` support — available since Node 20.19 / 22.12. On older Node, stay on bpmn-moddle 9 or migrate to `import`.

## Backward compatibility of persisted state

Because the serialized source context and the runtime state are independent of the `bpmn-moddle` version, **state saved by a deployment running bpmn-moddle 9 keeps resuming after an upgrade to bpmn-moddle 10** (and vice versa). `recover()` deserializes the embedded source context — or a source context you re-parse with the new version — without ever calling `bpmn-moddle` itself.

This is pinned down by the feature test [`test/feature/bpmn-moddle-backward-compatibility-feature.js`](../test/feature/bpmn-moddle-backward-compatibility-feature.js), which:

1. starts the _mother-of-all_ process from a context parsed with bpmn-moddle **9**, stops it at the first user task wait and saves the state;
2. re-parses the same source with bpmn-moddle **10**, recovers the v9 runtime state against the v10 source context, and resumes it to completion;
3. asserts that the source context serialized via 9 and via 10 are byte-for-byte equal;
4. runs the engine with the raw `source` option in a child process where `bpmn-moddle` resolves to **10**, proving the engine's own parse path handles the named export.
