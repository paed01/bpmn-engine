Form
====

Forms can be used by start events and user tasks.

The engine consideres forms as reference only. If task input is to be validated this is outside the engine for now. One suggestion would be to validate the activity output as part of the flow.

# API

## `activity.form.getFields()`

Get list of fields.

## `activity.form.key`

Form is referenced by key.

# Example

```javascript
const BpmnEngine = require('bpmn-engine');
const EventEmitter = require('events').EventEmitter;

const definitionXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="name" label="Some descriptive label" type="string" />
          <camunda:formField id="formKey" type="string" />
        </camunda:formData>
      </extensionElements>
    </startEvent>
    <userTask id="task" camunda:formKey="\${variables.formKey}" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
  </process>
</definitions>`;

const engine = new BpmnEngine.Engine({
  source: definitionXml,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});

const listener = new EventEmitter();
listener.on('wait', (activity) => {
  if (activity.form) {
    if (activity.form.key) {
      console.log(`activity ${activity.type} <${activity.id}> expects form with key "${activity.form.key}"`);
      return activity.signal({ key: activity.form.key });
    } else {
      console.log(`activity ${activity.type} <${activity.id}> setting form field`);
      const data = activity.form.getFields().reduce((result, field, idx) => {
        result[field.id] = `value${idx}`;
        console.log(`  ${field.id} = ${result[field.id]}`);
        return result;
      }, {});

      return activity.signal(data)
    }
  }
  return activity.signal();
});

engine.once('end', (e, def) => {
  console.log('Completed definition with form input', def.variables);
})

engine.execute({
  listener: listener
});
```
