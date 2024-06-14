import fs from 'node:fs';
import path from 'node:path';

export function valid(definitionId) {
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
        <conditionExpression xsi:type="tFormalExpression" language="JavaScript">next(null, true);</conditionExpression>
      </sequenceFlow>
    </process>
  </definitions>`;
}

export function invalid() {
  return `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end2">
      <conditionExpression xsi:type="tFormalExpression" language="JavaScript">next(null, false);</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;
}

export function userTask(userTaskId = 'userTask', definitionId = 'Def_1') {
  return `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions id="${definitionId}" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
      <dataObjectReference id="globalInputRef" dataObjectRef="input" />
      <dataObjectReference id="inputFromUserRef" dataObjectRef="inputFromUser" />
      <dataObject id="input" />
      <dataObject id="inputFromUser" />
      <startEvent id="theStart" />
      <userTask id="${userTaskId}">
        <ioSpecification id="inputSpec">
          <dataInput id="input_1" name="Surname" />
          <inputSet id="inputSet_1">
            <dataInputRefs>input_1</dataInputRefs>
          </inputSet>
          <dataOutput id="userInput" name="input" />
        </ioSpecification>
        <dataInputAssociation id="associatedInput" sourceRef="globalInputRef" targetRef="input_1" />
        <dataOutputAssociation id="associatedOutput" sourceRef="userInput" targetRef="inputFromUserRef" />
      </userTask>
      <endEvent id="theEnd" />
      <sequenceFlow id="flow1" sourceRef="theStart" targetRef="${userTaskId}" />
      <sequenceFlow id="flow2" sourceRef="${userTaskId}" targetRef="theEnd" />
    </process>
  </definitions>`;
}

export function multipleInbound() {
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
}

export function resource(name) {
  return fs.readFileSync(path.join('./test/resources', name));
}
