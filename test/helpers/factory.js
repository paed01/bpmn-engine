'use strict';

const fs = require('fs');
const path = require('path');

const invalidProcess = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript">true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
    `;

const pub = {};

pub.valid = (definitionId) => {
  if (!definitionId) definitionId = 'valid';
  return `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="${definitionId}" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess1" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript">true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
    `;
};

pub.invalid = () => {
  return invalidProcess;
};

pub.userTask = (userTaskId, definitionId) => {
  if (!userTaskId) userTaskId = 'userTask';
  return `
<?xml version="1.0" encoding="UTF-8"?>
<definitions id="${definitionId || 'testUserTask'}" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
    <dataObject id="inputFromUser" />
    <startEvent id="theStart" />
    <userTask id="${userTaskId}">
      <ioSpecification id="inputSpec">
        <dataOutput id="userInput" />
      </ioSpecification>
      <dataOutputAssociation id="associatedWith" sourceRef="userInput" targetRef="inputFromUserRef" />
    </userTask>
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="${userTaskId}" />
    <sequenceFlow id="flow2" sourceRef="${userTaskId}" targetRef="theEnd" />
  </process>
</definitions>`;
};

pub.multipleInbound = () => {
  return `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start" />
    <userTask id="userTask" />
    <task id="task" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="task" />
    <sequenceFlow id="flow3" sourceRef="userTask" targetRef="task" />
    <sequenceFlow id="flow4" sourceRef="userTask" targetRef="task" />
    <sequenceFlow id="endFlow" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;
};

pub.resource = function(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'resources', name));
};

module.exports = pub;
