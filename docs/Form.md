Form
====

Forms can be used by start events and user tasks.

The engine consideres forms as reference only. If task input is to be validated this is outside the engine for now. One suggestion would be to validate the activity output as part of the flow.

<!-- toc -->

- [API](#api)
  - [`activity.form.getFields()`](#activityformgetfields)
  - [`activity.formKey`](#activityformkey)
- [Example](#example)

<!-- tocstop -->

# API

## `activity.form.getFields()`

Get list of fields.

## `activity.formKey`

Form is referenced by key.

# Example

```javascript
const {Engine} = require('bpmn-engine');
const {EventEmitter} = require('events');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <startEvent id="start">
      <extensionElements>
        <camunda:formData>
          <camunda:formField id="name" label="Some descriptive label for \${variables.noun}" type="string" />
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

const engine = new Engine({
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});

const listener = new EventEmitter();
listener.on('wait', (activityApi) => {
  const {form, formKey, id, signal, type} = activityApi;

  if (form) {
    console.log(`activity ${type} <${id}> setting form field`);

    form.getFields().forEach(({id, get, label}, idx) => {
      form.setFieldValue(id, `value${idx}`);
      console.log(`  ${label} <${id}> = ${get()}`);
    });

    return signal(form.getOutput())
  } else if (formKey) {
    console.log(`activity ${type} <${id}> expects form with key "${formKey}"`);

    return signal({ key: formKey });
  }


  return signal();
});

engine.once('end', (execution) => {
  console.log('Completed definition with form input', execution.getOutput());
});

engine.execute({
  listener,
  variables: {
    noun: 'tea'
  }
});
```
