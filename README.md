bpmn-engine (WIP)
===========

[![Build Status](https://secure.travis-ci.org/paed01/bpmn-engine.png)](http://travis-ci.org/paed01/bpmn-engine)

## Introduction
**bpmn-engine** is an serverside BPMN 2.0 processengine based on [camunda/camunda-bpmn.js](https://github.com/camunda/camunda-bpmn.js) developed by [camunda.org](http://camunda.org/).

## Table of Contents
- [Examples](#examples)
    - [Start instance](#start-instance)
    - [Listen events](#listen-for-events)
    - [Transform BPMN xml to BPMN definition](#transform-bpmn-xml-to-bpmn-definition)
- [Usage](#usage)
    - [Bpmn.Engine](#bpmnengine)
        - [`new Engine([activityExecutionModule], [transformer])`](#new-engineactivityexecutionmodule-transformer)

# Examples

## Start instance
```javascript
var Bpmn = require('./index');

var bpmnSchema = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<process id="theProcess2" isExecutable="true">' +
                '<startEvent id="theStart" />' +
                '<exclusiveGateway id="decision" default="flow2" />' +
                '<endEvent id="end1" />' +
                '<endEvent id="end2" />' +
                '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />' +
                '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
                '<conditionExpression>true</conditionExpression>' +
                '</sequenceFlow>' +
                '</process>' +
                '</definitions>');

var engine = new Bpmn.Engine();
engine.startInstance(bpmnSchema, null, null, function (err, execution) {
    console.log('Process instance started with id', execution.uuid);
});
```

## Listen for events
```javascript
var Bpmn = require('./index');

var bpmnSchema = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<process id="theProcess2" isExecutable="true">' +
                '<startEvent id="theStart" />' +
                '<exclusiveGateway id="decision" default="flow2" />' +
                '<endEvent id="end1" />' +
                '<endEvent id="end2" />' +
                '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />' +
                '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
                '<conditionExpression>true</conditionExpression>' +
                '</sequenceFlow>' +
                '</process>' +
                '</definitions>');

var engine = new Bpmn.Engine();
engine.startInstance(bpmnSchema, null, null, function (err, execution) {
    execution.on('start', function(e) {
        console.log(e.type, e.id, 'started');
    })
    execution.on('end', function(e) {
        console.log(e.type, e.id, 'ended');
    })
    execution.on('take', function(e) {
        console.log(e.type, e.id, 'taken');
    })
});
```

## Transform BPMN xml to BPMN definition
```javascript
var Bpmn = require('./index');
var Xmldom = require('xmldom');

var bpmnSchema = '<?xml version="1.0" encoding="UTF-8"?>' +
                '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<process id="theProcess2" isExecutable="true">' +
                '<startEvent id="theStart" />' +
                '<exclusiveGateway id="decision" default="flow2" />' +
                '<endEvent id="end1" />' +
                '<endEvent id="end2" />' +
                '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />' +
                '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
                '<conditionExpression>true</conditionExpression>' +
                '</sequenceFlow>' +
                '</process>' +
                '</definitions>';

var transformer = new Bpmn.Transformer();

// Transformer requires xmldom module to traverse XML
var bpmnDom = new Xmldom.DOMParser().parseFromString(bpmnSchema);

transformer.transform(bpmnDom, true, function (err, bpmnDefinitions) {
    console.log(bpmnDefinitions[0]);    
});
```

# Usage

## Bpmn.Engine
The Bpmn.Engine is responsible to execute workflows.

### `new Engine([activityExecutionModule), ([transformer])`
The constructor takes two optional arguments:

- `activityExecutionModule` - A reference to a [Activity Execution Module](#activityExecutionModule)
- `transformer` - An instance of the [Transformer](#transformer)

If passed nothing the constructor will take the default Activity Execution Module and instantiate the built-in Transformer.

## Transformer BPMN 2.0
This module provides the functionality necessary to transform a BPMN 2.0 XML file into a Tree of Java Script objects that can be consumed by the [Engine](#engine).

## Activity Execution Module


