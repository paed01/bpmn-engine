ServiceTask
===========

Inherits from [Activity](/docs/Activity.md).

<!-- toc -->

- [Define service](#define-service)
  - [Expression](#expression)

<!-- tocstop -->

# Define service

How to reference service function.

# Expression

Define as expression referencing a service function.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask1" name="Get" implementation="\${services.get}" />
    <serviceTask id="serviceTask2" name="Get with var" implementation="\${services.getService(variables.choice)}" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'service expression example',
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }
});

engine.execute({
  services: {
    get: (context, next) => {
      console.log('RUN GET');
      next();
    },
    getService: (choice) => {
      console.log('RETURN', choice);
      return function(context, next) {
        console.log('RUN', choice);
      }
    },
  },
  variables: {
    choice: 'Ehm...',
    api: 'http://example.com'
  }
});

engine.once('end', () => {
  console.log('Completed!');
});
```
