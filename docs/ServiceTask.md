ServiceTask
===========

<!-- toc -->

- [Define service](#define-service)
  - [Expression](#expression)

<!-- tocstop -->

# Define service

How to reference service function.

## Expression

Define an expression in `implementation` attribute referencing a service function.

```javascript
'use strict';

const {Engine} = require('bpmn-engine');

const source = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask1" name="Get" implementation="\${services.get}" />
    <serviceTask id="serviceTask2" name="Get with var" implementation="\${services.getService(variables.choice)}" />
    <sequenceFlow id="flow1" sourceRef="serviceTask1" targetRef="serviceTask2" />
  </process>
</definitions>`;

const engine = Engine({
  name: 'service expression example',
  source
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
        next(null, choice);
      };
    },
  },
  variables: {
    choice: 'Ehm...',
    api: 'http://example.com'
  }
});

engine.on('end', () => {
  console.log('Completed!');
});
```
