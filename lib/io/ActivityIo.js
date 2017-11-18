'use strict';

const Debug = require('debug');
const expressions = require('../expressions');
const getNormalizedResult = require('../getNormalizedResult');

module.exports = function ActivityIO(activityElement, parentContext) {
  const {id, $type} = activityElement;
  const type = `io:${$type}`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const {ios, forms, properties} = parentContext.getActivityExtensions(activityElement);
  const {environment} = parentContext;

  return {
    id,
    type,
    activate,
    resume: resumeIo
  };

  function resumeIo(parentApi, state) {
    const ioApi = activate(parentApi);
    ioApi.resume(state.io);
    return ioApi;
  }

  function activate(parentApi, message) {
    let formInstances, ioInstances, propertyValues, resultData;
    let assignedOutputValues, assignedInputValues;

    if (message) {
      message = getNormalizedResult(message, 'message');
    }

    const inputContext = environment.getVariablesAndServices(message);
    const props = getProperties();
    if (props) {
      inputContext.properties = props;
    }

    const {id: activityId} = parentApi;
    const {isLoopContext, index} = inputContext;
    if (!isLoopContext && parentApi.loopCharacteristics) {
      inputContext.isLooped = true;
    }

    const hasIo = !!ios.length;

    debug(`<${activityId}> io${isLoopContext ? ` loop context iteration ${index}` : ''} activated`);

    return {
      id,
      type,
      isLoopContext,
      hasIo,
      getForm,
      getInput,
      getInputContext,
      getOutput,
      getProperties,
      getState,
      resolveExpression,
      resume,
      save,
      setInputValue,
      setOutputValue,
      setResult
    };

    function getInput() {
      const baseInput = assignInputValues(message);
      if (!hasIo) return baseInput;

      debug(`<${id}> get input`);
      return getIos().reduce((result, io) => {
        Object.assign(result, getNormalizedResult(io.getInput(), io.type));
        return result;
      }, baseInput || {});
    }

    function getInputContext() {
      const baseInput = assignInputValues(inputContext);
      if (!hasIo) return baseInput;

      return getIos().reduce((result, io) => {
        Object.assign(result, getNormalizedResult(io.getInput(), io.type));
        return result;
      }, baseInput);
    }

    function getOutput() {
      const loadedIos = getIos();
      if (loadedIos) return getIoOutput();


      return getNonIoOutput();
    }

    function getIoOutput() {
      const loadedIos = getIos();

      if (loadedIos.length === 1) return loadedIos[0].getOutput();

      return loadedIos.reduce((result, io) => {
        Object.assign(result, getNormalizedResult(io.getOutput(), io.type));
        return result;
      }, {});
    }

    function getNonIoOutput() {
      if (assignedOutputValues) {
        return Object.assign({}, getNormalizedResult(resultData), assignedOutputValues);
      }
      return resultData;
    }

    function getState() {
      const result = {};
      const loadedIos = getIos();
      if (loadedIos) {
        const ioState = {};
        loadedIos.forEach((io) => {
          Object.assign(ioState, io.getState());
        });
        if (Object.keys(ioState).length) {
          result.io = ioState;
        }
      } else if (forms && formInstances) {
        const formState = {};
        formInstances.forEach((form) => {
          Object.assign(formState, form.getState());
        });
        if (Object.keys(formState).length) {
          result.form = formState;
        }
      }

      return result;
    }

    function resume(ioState) {
      inputContext.resumed = true;

      if (!hasIo) return;
      if (!ioState) return;

      ioInstances = ios.map((io) => io.resume(parentApi, inputContext, ioState));
    }

    function resolveExpression(expression) {
      return expressions(expression, getInputContext());
    }

    function save() {
      const loadedIos = getIos();
      if (loadedIos) {
        debug(`<${id}> save`);
        return ioInstances.forEach((io) => io.save());
      }

      debug(`<${id}> save as task input`);
      environment.assignTaskInput(id, getNonIoOutput());
    }

    function setInputValue(name, value) {
      if (!name) return;
      const loadedIos = getIos();
      let isSet;
      if (loadedIos) {
        for (let i = 0; i < loadedIos.length; ++i) {
          if (loadedIos[i].setInputValue(name, value)) {
            isSet = true;
          }
        }
      }
      if (!isSet) {
        assignedInputValues = assignedInputValues || {};
        assignedInputValues[name] = value;
      }
    }

    function setOutputValue(name, value) {
      if (!name) return;
      const loadedIos = getIos();
      if (loadedIos) {
        return loadedIos.forEach((io) => io.setOutputValue(name, value));
      }
      assignedOutputValues = assignedOutputValues || {};
      assignedOutputValues[name] = value;
    }

    function setResult(result1, ...args) {
      resultData = args.length ? [result1, ...args] : result1;
      const loadedIos = getIos();
      if (loadedIos) loadedIos.forEach((io) => io.setResult(result1, ...args));
    }

    function getIos() {
      if (!hasIo) return;
      if (ioInstances) return ioInstances;
      ioInstances = ios.map((io) => io.activate(parentApi, inputContext));
      return ioInstances;
    }

    function getProperties() {
      if (propertyValues) return propertyValues;
      if (!properties) return;

      propertyValues = properties.reduce((result, propsDef) => {
        const values = propsDef.activate(parentApi, inputContext).get();
        Object.assign(result, values);
        return result;
      }, {});

      return propertyValues;
    }

    function getForm() {
      const loadedForms = getForms();
      if (!loadedForms) return;
      return loadedForms[0];
    }

    function getForms() {
      if (formInstances) return formInstances;

      formInstances = getIoForms();
      if (formInstances) return formInstances;

      if (forms && forms.length) {
        formInstances = forms.map((f) => f.activate(parentApi, inputContext));
      }

      return formInstances;
    }

    function getIoForms() {
      const loadedIos = getIos();
      if (!loadedIos) return;

      const ioFormInstances = loadedIos.reduce((result, io) => {
        const form = io.getForm();
        if (form) result.push(form);
        return result;
      }, []);

      return ioFormInstances;
    }

    function assignInputValues(base) {
      if (!base) return assignedInputValues;
      if (!assignedInputValues) return base;
      return Object.assign(base, assignedInputValues);
    }
  }
};

