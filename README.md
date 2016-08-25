bpmn-engine
===========

[![Project Status: WIP - Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](http://www.repostatus.org/badges/latest/wip.svg)](http://www.repostatus.org/#wip)

[![Build Status](https://travis-ci.org/paed01/bpmn-engine.svg?branch=master)](https://travis-ci.org/paed01/bpmn-engine)

## Introduction
**bpmn-engine** is an serverside BPMN 2.0 processengine based on [bpmn-io/bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) developed by [bpmn.io](http://bpmn.io/).

## Table of Contents
- [Examples](#examples)
    - [Start instance](#start-instance)
    - [Listen events](#listen-for-events)
    - [Script task](#script-task)

# Examples

## Start instance
```javascript
const Bpmn = require('bpmn-engine');

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

engine.startInstance(null, null, (err, execution) => {
  console.log('Process instance started with id', execution.uuid);
});
```

## Listen for events
```javascript
const Bpmn = require('bpmn-engine');

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

listener.once('start-userTask', (activity) => {
  console.log('Signal userTask when started')
  activity.signal({
    input: {
      sirname: 'von Rosen'
    }
  });
});

engine.startInstance({
  input: null
}, listener, (err, execution) => {
  if (err) return done(err);
  console.log(`User sirname is ${execution.variables.input.sirname}`);
});
```

## Script task

A script task will receive the data available on the process instance. So if `request` or another module is needed it has to be passed when starting the process. The script task also has a callback called `next` that takes an occasional error. The `next` callback has to be called for the process to proceed.

```javascript
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
          const result = JSON.parse(body);
          self.context.scriptTaskData = result;
          next();
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
  if (err) return done(err);

  execution.once('end', () => {
    console.log('Script task result:', excecution.variables.scriptTaskData);
  });
});
```
