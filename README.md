# bpmn-engine

[![Project Status: Active - The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)

[![Build Status](https://app.travis-ci.com/paed01/bpmn-engine.svg?branch=master)](https://app.travis-ci.com/paed01/bpmn-engine)[![Build status](https://ci.appveyor.com/api/projects/status/670n39fivq1g3nu5?svg=true)](https://ci.appveyor.com/project/paed01/bpmn-engine)[![Coverage Status](https://coveralls.io/repos/github/paed01/bpmn-engine/badge.svg?branch=master)](https://coveralls.io/github/paed01/bpmn-engine?branch=master)

# Introduction

BPMN 2.0 execution engine. Open source javascript workflow engine.

- [API](/docs/API.md)
- [Changelog](/CHANGELOG.md)
- [Examples](/docs/Examples.md)
- [Upgrade version](/docs/Upgrade.md)
- [Supported elements](#supported-elements)
- [Debug](#debug)
- [Example process](#a-pretty-image-of-a-process)
- [Acknowledgments](#acknowledgments)

# Supported elements

See [bpmn-elements](https://github.com/paed01/bpmn-elements) for supported elements. The engine only support elements and attributes included in the BPMN 2.0 scheme, but can be extended to understand other schemas and elements.

The aim is to, at least, have BPMN 2.0 [core support](https://www.omg.org/bpmn/Samples/Elements/Core_BPMN_Elements.htm).

# Debug

This package is shipped with [debug](https://github.com/debug-js/debug) activated with environment variable `DEBUG=bpmn-engine:*`. You can also provide your own logger.

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

# A pretty image of a process

![Mother of all](https://raw.github.com/paed01/bpmn-engine/master/images/mother-of-all.png)

# Acknowledgments

The **bpmn-engine** resides upon the excellent library [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](https://bpmn.io/)

All diagrams are designed with [Camunda modeler](https://camunda.com/download/modeler/).
