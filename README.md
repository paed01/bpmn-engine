bpmn-engine
===========

[![Project Status: Active - The project has reached a stable, usable state and is being actively developed.](http://www.repostatus.org/badges/latest/active.svg)](http://www.repostatus.org/#active)

[![Build Status](https://travis-ci.org/paed01/bpmn-engine.svg?branch=master)](https://travis-ci.org/paed01/bpmn-engine)[![Build status](https://ci.appveyor.com/api/projects/status/670n39fivq1g3nu5/branch/master?svg=true)](https://ci.appveyor.com/project/paed01/bpmn-engine/branch/master)[![Coverage Status](https://coveralls.io/repos/github/paed01/bpmn-engine/badge.svg?branch=master)](https://coveralls.io/github/paed01/bpmn-engine?branch=master)

## Introduction
**bpmn-engine** is an serverside BPMN 2.0 processengine.

## Table of Contents
- [Supported elements](#supported-elements)
- [Debug](#debug)
- [Acknowledgments](#acknowledgments)
- [API](#api)

# Supported elements

The following elements are tested and supported.

- Process
- Lane
- Flows:
  - Sequence: javascript- and expression conditions
  - Message
- Events
  - Start
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
    - Cardinality
    - Condition, script or expression
    - Collection (camunda expression)
  - SubProcess
  - Script: javascript only
  - Task: completes immediately
  - User: needs signal
  - Service: Declared when starting instance
- Gateways
  - Exclusive
  - Inclusive
  - Parallel: join and fork

# Debug

The module uses [debug](github.com/visionmedia/debug) so run with environment variable `DEBUG=bpmn-engine:*`.

# Acknowledgments

The **bpmn-engine** resides upon the excellent library [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](http://bpmn.io/)

# API

See the [API Reference](API.md)
