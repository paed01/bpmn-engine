Extensions
==========

<!-- toc -->

- [Extension properties](#extension-properties)
  - [Service](#service)
    - [Activate function](#activate-function)
  - [IO](#io)
  - [Form](#form)
  - [Properties](#properties)

<!-- tocstop -->

Extension can be a module that exports `moddleOptions` and an extension function. The Camunda Modeler extension can be found under [bpmn-engine-extensions](https://github.com/paed01/bpmn-engine-extensions).

Example:

```javascript
'use strict';

const moddleOptions = require('./js-bpmn-moddle.json');

module.exports = {
  extension: Js,
  moddleOptions
};

function Js(activityElement, parentContext) {
  const {formKey} = activityElement;

  const form = loadForm();

  return {
    form
  };

  function loadForm() {
    if (formKey) return FormKey(activityElement, parentContext);
  }
}

function FormKey(activityElement) {
  const {id, formKey} = activityElement;
  const type = 'js:formKey';

  return {
    id,
    type,
    activate
  };

  function activate() {
    return {
      id,
      type,
      getState
    };

    function getState() {
      return {
        key: formKey
      };
    }
  }
}
```

# Extension properties

- `service`: Service implementation
- `io`: Activity input/output
- `form`: Activity form
- `properties`: Activity properties

## Service

Should return an object with:

- `activate`: Activation function
- `type`: Service type string

### Activate function

Signature is:

- `parentApi`: Activity parent API
- `inputContext`: Object with input to activity

Must return object with:

- `execute`: Service function
- `type`: Service type, arbitrary string

## IO

## Form

## Properties
