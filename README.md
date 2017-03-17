bpmn-engine
===========

[![Project Status: Active - The project has reached a stable, usable state and is being actively developed.](http://www.repostatus.org/badges/latest/active.svg)](http://www.repostatus.org/#active)

[![Build Status](https://travis-ci.org/paed01/bpmn-engine.svg?branch=master)](https://travis-ci.org/paed01/bpmn-engine)[![Build status](https://ci.appveyor.com/api/projects/status/670n39fivq1g3nu5/branch/master?svg=true)](https://ci.appveyor.com/project/paed01/bpmn-engine/branch/master)[![Coverage Status](https://coveralls.io/repos/github/paed01/bpmn-engine/badge.svg?branch=master)](https://coveralls.io/github/paed01/bpmn-engine?branch=master)

## Introduction
**bpmn-engine** is an open-source serverside workflow engine built with javascript. Then engine executes automated processes modeled according to the standard Business Process Model and Notation - BPMN 2.0.

## Table of Contents
- [Supported elements](#supported-elements)
- [Process modeller](#process-modeller)
- [Debug](#debug)
- [Acknowledgments](#acknowledgments)
- [Changelog](/Changelog.md)

### Documentation
- [API](/API.md)
- [Examples](/docs/Examples.md)

# Supported elements

The following elements are tested and supported.

- [Definition](/docs/Definition.md)
- Process
- Lane
- Flows:
  - Sequence: javascript- and expression conditions
  - Message
- Events
  - [Start](/docs/StartEvent.md)
  - End
  - Error
    - Boundary
  - Message
    - Start
    - Intermediate
  - Timer: with duration as ISO_8601
    - Intermediate
    - Boundary Interupting
    - Boundary Non-interupting
- Tasks
  - Sequential loop
    - Cardinality, integer or expression
    - Condition, script or expression
    - Collection (camunda expression)
  - SubProcess
  - Script: javascript only
  - Task: completes immediately
  - User: needs signal
  - Service
  - Send
  - Receive
- Gateways
  - Exclusive
  - Inclusive
  - Parallel: join and fork
- [Form](/docs/Form.md)

# Process modeller

The processes are modelled using [Camunda modeler](https://camunda.org/bpmn/tool/).

![Mother of all](https://raw.github.com/paed01/bpmn-engine/master/images/mother-of-all.png)

# Debug

The module uses [debug](github.com/visionmedia/debug) so run with environment variable `DEBUG=bpmn-engine:*`.

# Acknowledgments

The **bpmn-engine** resides upon the excellent library [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](http://bpmn.io/)
