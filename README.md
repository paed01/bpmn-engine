bpmn-engine
===========

[![Project Status: WIP - Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](http://www.repostatus.org/badges/latest/wip.svg)](http://www.repostatus.org/#wip)

[![Build Status](https://travis-ci.org/paed01/bpmn-engine.svg?branch=master)](https://travis-ci.org/paed01/bpmn-engine)[![Coverage Status](https://coveralls.io/repos/github/paed01/bpmn-engine/badge.svg?branch=master)](https://coveralls.io/github/paed01/bpmn-engine?branch=master)

## Introduction
**bpmn-engine** is an serverside BPMN 2.0 processengine based on [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](http://bpmn.io/).

## Table of Contents
- [Supported elements](#supported-elements)
- [Execution events](#execution-events)
- [Examples](#examples)
    - [Start instance](#start-instance)
    - [Listen events](#listen-for-events)
    - [Exclusive gateway](#exclusive-gateway)
    - [Script task](#script-task)
    - [User task](#user-task)
- [Debug](#debug)

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

# Element events

- `enter`: An element is entered
- `start`: An element is started
- `wait`: An user task waits for signal
- `end`: A task has ended successfully
- `cancel`: An element execution was canceled
- `leave`: The execution left the element
- `error`: An error was emitted (unless a bound error event is in place)

# Sequence flow events

- `taken`: The sequence flow was taken
- `discarded`: The sequence flow was discarded

# Examples

## Start instance
```javascript
const Bpmn = require('bpmn-engine');
const uuid = require('node-uuid');

const bpmnSchema = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression>true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

const engine = new Bpmn.Engine(bpmnSchema);

engine.startInstance({ uuid: uuid.v4() }, null, (err, execution) => {
  console.log('Process instance started with id', execution.variables.uuid);
});
```

## Listen for events
```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="userTask">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine(processXml);
const listener = new EventEmitter();

listener.once('wait-userTask', (activity) => {
  console.log('Signal userTask when waiting');
  activity.signal({
    sirname: 'von Rosen'
  });
});

engine.startInstance({
  input: null
}, listener, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    console.log(`User sirname is ${execution.variables.inputFromUser.sirname}`);
  });
});
```

## Exclusive gateway

An exclusive gateway will receive the available process variables as `this.context`.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.context.input <= 50
      ]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript"><![CDATA[
      this.context.input > 50
      ]]></conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;

const engine = new Bpmn.Engine(processXml);
engine.startInstance({
  input: 51
}, null, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    if (execution.getChildActivityById('end1').taken) throw new Error('<end1> was not supposed to be taken, check your input');
    console.log('TAKEN end2', execution.getChildActivityById('end2').taken);
  });
});
```

## Script task

A script task will receive the data available on the process instance. So if `request` or another module is needed it has to be passed when starting the process. The script task also has a callback called `next` that takes an occasional error. The `next` callback has to be called for the process to proceed.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
  <startEvent id="theStart" />
  <scriptTask id="scriptTask" scriptFormat="Javascript">
    <script>
      <![CDATA[
        const request = context.request;

        const self = this;

        request.get('http://example.com/test', (err, resp, body) => {
          if (err) return next(err);
          self.context.scriptTaskCompleted = true;
          next(null, {result: body});
        })
      ]]>
    </script>
  </scriptTask>
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="scriptTask" />
  <sequenceFlow id="flow2" sourceRef="scriptTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine(processXml);
engine.startInstance({
  request: require('request')
}, null, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    console.log('Script task modification:', execution.variables.scriptTaskCompleted);
    console.log('Script task output:', execution.variables.taskInput.scriptTask.result);
  });
});
```

## User task
```javascript
'use strict';

const Bpmn = require('bpmn-engine');

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="userTask">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine(processXml);
const listener = new EventEmitter();

listener.once('wait', (child, execution) => {
  execution.signal(child.activity.id, {
    sirname: 'von Rosen'
  });
});

engine.startInstance({
  input: null
}, listener, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    console.log(`User sirname is ${execution.variables.inputFromUser.sirname}`);
  });
});
```

Since, Imho, the data flow in bpmn2 is overcomplex the input is stored as `taskInput` with id if data associations dont´t exist.

```javascript
'use strict';

const Bpmn = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <userTask id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const engine = new Bpmn.Engine(processXml);
const listener = new EventEmitter();

listener.once('wait-userTask', (child, execution) => {
  execution.signal(child.activity.id, {
    sirname: 'von Rosen'
  });
});

engine.startInstance(null, listener, (err, execution) => {
  if (err) throw err;

  execution.once('end', () => {
    console.log(`User sirname is ${execution.variables.taskInput.userTask.sirname}`);
  });
});
```

# Debug

The module uses [debug](github.com/visionmedia/debug) so run with environment variable `DEBUG=bpmn-engine:*`.


