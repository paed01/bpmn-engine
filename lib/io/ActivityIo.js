'use strict';

const Debug = require('debug');
const expressions = require('../expressions');
const getNormalizedResult = require('../getNormalizedResult');

module.exports = function ActivityIO(activityElement, parentContext) {
  const {id, $type} = activityElement;
  const type = `io:${$type}`;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const {ios, properties} = parentContext.getActivityExtensions(activityElement);
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
    let formInstances, formKey, ioInstances, propertyValues, resultData;
    let assignedOutputValues;

    const inputContext = environment.getVariablesAndServices(getNormalizedResult(message, 'message'));
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
      getFormKey,
      getInput,
      getInputContext,
      getOutput,
      getProperties,
      getState,
      resolveExpression,
      resume,
      save,
      setOutputValue,
      setResult
    };

    function getInput() {
      if (!hasIo) return message;

      debug(`<${id}> get input`);
      return getIos().reduce((result, io) => {
        Object.assign(result, getNormalizedResult(io.getInput(), io.type));
        return result;
      }, {});
    }

    function getInputContext() {
      if (!hasIo) return inputContext;

      const loadedIos = getIos();
      if (loadedIos.length === 1) return loadedIos[0].getOutput();

      return getIos().reduce((result, io) => {
        Object.assign(result, getNormalizedResult(io.getInput(), io.type));
        return result;
      }, inputContext);
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
      const loadedIos = getIos();
      if (!loadedIos) return {};

      const result = {};
      const ioState = {};
      loadedIos.forEach((io) => {
        Object.assign(ioState, io.getState());
      });
      if (Object.keys(ioState).length) {
        result.io = ioState;
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

    function getFormKey() {
      if (formKey !== undefined) return formKey;
      const instances = getForms();
      if (!instances) return;

      for (let i = 0; i < instances.length; i++) {
        if (instances[i].formKey) {
          formKey = instances[i].formKey;
          return formKey;
        }
      }
      formKey = null;
    }

    function getForms() {
      if (formInstances) return formInstances;

      const loadedIos = getIos();
      if (!loadedIos) return;

      formInstances = loadedIos.reduce((result, io) => {
        const form = io.getForm();
        if (form) result.push(form);
        return result;
      }, []);

      return formInstances;
    }
  }

};

