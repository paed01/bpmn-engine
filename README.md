# bpmn-engine

[![Project Status: Active - The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)

[![Build](https://github.com/paed01/bpmn-engine/actions/workflows/build.yaml/badge.svg)](https://github.com/paed01/bpmn-engine/actions/workflows/build.yaml)[![Build (Windows)](https://github.com/paed01/bpmn-engine/actions/workflows/build-windows.yaml/badge.svg)](https://github.com/paed01/bpmn-engine/actions/workflows/build-windows.yaml)[![Coverage Status](https://coveralls.io/repos/github/paed01/bpmn-engine/badge.svg?branch=master)](https://coveralls.io/github/paed01/bpmn-engine?branch=master)

## Introduction

BPMN 2.0 execution engine. Open source javascript workflow engine.

Documentation:

- [API](/docs/API.md)
- [Examples](/docs/Examples.md)
- [Upgrade version](/docs/Upgrade.md)
- [bpmn-moddle 9 vs 10](/docs/bpmn-moddle.md)
- [Changelog](/CHANGELOG.md)

<!-- toc -->

- [Peer dependencies](#peer-dependencies)
- [Supported elements](#supported-elements)
- [Extensions](#extensions)
- [Debug](#debug)
- [A pretty image of a process](#a-pretty-image-of-a-process)
- [Ecosystem](#ecosystem)
- [Acknowledgments](#acknowledgments)

<!-- /toc -->

## Peer dependencies

The runtime dependencies are declared as **peer dependencies**, so you install and pin them yourself and the engine reuses your single copy:

```sh
npm install bpmn-engine bpmn-elements bpmn-moddle moddle-context-serializer debug smqp
```

| Peer dependency                                                                    | Range       | Role                                              |
| ---------------------------------------------------------------------------------- | ----------- | ------------------------------------------------- |
| [`bpmn-elements`](https://github.com/paed01/bpmn-elements)                         | `>=18.0.25` | element behaviour functions                       |
| [`bpmn-moddle`](https://github.com/bpmn-io/bpmn-moddle)                            | `>=9`       | BPMN XML parser ([9 vs 10](/docs/bpmn-moddle.md)) |
| [`moddle-context-serializer`](https://github.com/paed01/moddle-context-serializer) | `>=6`       | persistable source context                        |
| [`smqp`](https://github.com/paed01/smqp)                                           | `>=15`      | message broker driving execution                  |
| [`debug`](https://github.com/debug-js/debug)                                       | `>=4`       | logging                                           |

`bpmn-moddle` spans a major version on purpose — see [bpmn-moddle 9 vs 10](/docs/bpmn-moddle.md) for the import change and how persisted state stays compatible across the upgrade.

## Supported elements

See [bpmn-elements](https://github.com/paed01/bpmn-elements) for supported elements. The engine only support elements and attributes included in the BPMN 2.0 scheme, but can be extended to understand other schemas and elements.

The aim is to, at least, have BPMN 2.0 [core support](https://www.omg.org/bpmn/Samples/Elements/Core_BPMN_Elements.htm).

## Extensions

The engine can be extended to understand other schemas and elements. Docs, guides, and ready-made extensions for the BPMN stack are published at [0dep.se](https://0dep.se) — check there before writing a new extension from scratch.

Two ready-made extensions:

- [`@0dep/bpmn-extensions`](https://github.com/zerodep/bpmn-extensions)
- [`@onify/flow-extensions`](https://github.com/onify/flow-extensions)

## Debug

This package is shipped with [debug](https://www.npmjs.com/package/debug) activated with environment variable `DEBUG=bpmn-engine:*`. You can also provide your own logger.

More granular debugging can be achieved by filtering on element type:

```sh
DEBUG=*scripttask*,*:error:*
```

or on Windows PowerShell:

```powershell
$env:DEBUG='bpmn-engine:*'
```

and to turn it off you need to:

```powershell
$env:DEBUG=''
```

## A pretty image of a process

![Mother of all](https://raw.github.com/paed01/bpmn-engine/master/images/mother-of-all.png)

## Ecosystem

Packages that build on or complement the engine:

- [bpmn-elements](https://github.com/paed01/bpmn-elements) — BPMN 2.0 executable elements
- [bpmn-middleware](https://github.com/zerodep/bpmn-middleware) — Express middleware exposing the engine over HTTP, with pluggable state storage.
- [@0dep/bpmn-extensions](https://github.com/zerodep/bpmn-extensions) — Flow extensions for `bpmn-elements`: FEEL expressions and the zeebe-namespace BPMN extension elements.
- [@onify/flow-extensions](https://github.com/onify/flow-extensions) — Onify Flow extensions for `bpmn-elements`.
- [dmn-elements](https://github.com/zerodep/dmn-elements) — Executable DMN 1.3 decision elements; back a Business Rule Task with it.
- [BPMN Runner](https://0dep.se/run/) — Browser-based BPMN 2.0 and DMN runner built on `bpmn-elements`, `@0dep/bpmn-extensions`, and `dmn-elements`; run and step through diagrams client-side with live element highlighting, no data leaves the browser.

## Acknowledgments

The **bpmn-engine** resides upon the excellent library [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](https://bpmn.io/)

All diagrams are designed with [Camunda modeler](https://docs.camunda.io/downloads/).
