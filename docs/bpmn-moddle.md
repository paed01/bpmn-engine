# bpmn-moddle 9 → 10

`bpmn-engine` declares [`bpmn-moddle`](https://github.com/bpmn-io/bpmn-moddle) as a **peer dependency** with the range `>=10`. You install it yourself:

```sh
npm install bpmn-engine bpmn-moddle smqp
```

Up to v26 the engine ran on either the 9.x or the 10.x line. Since v27 only 10 and later is supported, so a deployment still on bpmn-moddle 9 has to upgrade it together with the engine.

The engine uses `bpmn-moddle` only to parse BPMN XML into a moddle context (`new BpmnModdle().fromXML(source)`). The moddle context is then handed to [`moddle-context-serializer`](https://github.com/paed01/moddle-context-serializer) to produce the persistable source context. Everything downstream of the parse — execution, `getState()`, `recover()`, `resume()` — is independent of the `bpmn-moddle` version.

## What changed in 10

The output of `fromXML()` is unchanged between 9 and 10 — same `{ rootElement, elementsById, references, warnings }` shape, same element ids and references. The breaking change is purely how the package is consumed:

|               | bpmn-moddle 9                          | bpmn-moddle 10                             |
| ------------- | -------------------------------------- | ------------------------------------------ |
| Module format | ES module and CommonJS builds          | ES module only                             |
| Parser export | **default** export                     | **named** export `BpmnModdle`              |
| Import        | `import BpmnModdle from 'bpmn-moddle'` | `import { BpmnModdle } from 'bpmn-moddle'` |

```js
// bpmn-moddle 9
import BpmnModdle from 'bpmn-moddle';

// bpmn-moddle 10
import { BpmnModdle } from 'bpmn-moddle';
```

`bpmn-engine` imports the named export, which is why it no longer loads with bpmn-moddle 9 installed.

## What to do

- If the engine parses the XML for you through the `source` option, installing bpmn-moddle 10 is all it takes.
- If you parse the XML yourself — to pass the `moddleContext` option, or to build a `sourceContext` with `moddle-context-serializer` — switch your own import to the named export.

## Backward compatibility of persisted state

Because the serialized source context and the runtime state are independent of the `bpmn-moddle` version, **state saved by a deployment running bpmn-moddle 9 keeps resuming after the upgrade to bpmn-moddle 10**. `recover()` deserializes the embedded source context — or a source context you re-parse with the new version — without ever calling `bpmn-moddle` itself.

This is pinned down by the feature test [`test/feature/bpmn-moddle-backward-compatibility-feature.js`](../test/feature/bpmn-moddle-backward-compatibility-feature.js), which:

1. starts the _mother-of-all_ process from a context parsed with bpmn-moddle **9**, stops it at the first user task wait and saves the state;
2. re-parses the same source with bpmn-moddle **10**, recovers the v9 runtime state against the v10 source context, and resumes it to completion;
3. asserts that the source context serialized via 9 and via 10 are equal.
