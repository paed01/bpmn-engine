bpmn-engine
===========

[![Project Status: Active - The project has reached a stable, usable state and is being actively developed.](http://www.repostatus.org/badges/latest/active.svg)](http://www.repostatus.org/#active)

[![Build Status](https://travis-ci.org/paed01/bpmn-engine.svg)](https://travis-ci.org/paed01/bpmn-engine)[![Build status](https://ci.appveyor.com/api/projects/status/670n39fivq1g3nu5?svg=true)](https://ci.appveyor.com/project/paed01/bpmn-engine)

## Introduction
BPMN 2.0 execution engine. Open source javascript workflow engine.

## Table of Contents
- [Supported elements](#supported-elements)
- [Process modeller](#process-modeller)
- [Debug](#debug)
- [Acknowledgments](#acknowledgments)
- [Changelog](/Changelog.md)

### Documentation
- [API](/docs/API.md)
- [Examples](/docs/Examples.md)

# Supported elements

See [bpmn-elements](https://github.com/paed01/bpmn-elements) for supported elements.

# Process modeller

The processes are modelled using [Camunda modeler](https://camunda.org/bpmn/tool/).

![Mother of all](https://raw.github.com/paed01/bpmn-engine/master/images/mother-of-all.png)

# Debug

The module uses [debug](github.com/visionmedia/debug) so run with environment variable `DEBUG=bpmn-engine:*`.

# Acknowledgments

The **bpmn-engine** resides upon the excellent library [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](http://bpmn.io/)
