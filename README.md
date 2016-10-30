bpmn-engine
===========

[![Project Status: WIP - Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](http://www.repostatus.org/badges/latest/wip.svg)](http://www.repostatus.org/#wip)

[![Build Status](https://travis-ci.org/paed01/bpmn-engine.svg?branch=master)](https://travis-ci.org/paed01/bpmn-engine)[![Coverage Status](https://coveralls.io/repos/github/paed01/bpmn-engine/badge.svg?branch=master)](https://coveralls.io/github/paed01/bpmn-engine?branch=master)

## Introduction
**bpmn-engine** is an serverside BPMN 2.0 process engine.

## Table of Contents
- [Supported elements](#supported-elements)
- [Debug](#debug)
- [Acknowledgments](#acknowledgments)
- [API](API.md).

# Supported elements

The following elements are tested and supported.

- Process
- Lane
- Flows:
  - Sequence: javascript conditions only
  - Message
- Events
  - Start
  - End
  - Message (intermediate)
  - Intermediate Timer: with duration as ISO_8601
  - Interupting Timer Boundary Event: with duration as ISO_8601
  - Non-interupting Timer Boundary Event: with duration as ISO_8601
  - Error Boundary Event
- Tasks
  - SubProcess
    - Sequential loop
  - Script: javascript only
    - Sequential loop
  - Task: completes immediately
    - Sequential loop
  - User: needs signal
    - Sequential loop
- Gateways
  - Exclusive
  - Inclusive
  - Parallel: join and fork

# Debug

The module uses [debug](github.com/visionmedia/debug) so run with environment variable `DEBUG=bpmn-engine:*`.

# Acknowledgments

The **bpmn-engine** was made possible by the excellent BPMN 2.0 parser library [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle).
