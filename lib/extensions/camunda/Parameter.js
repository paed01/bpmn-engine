'use strict';

const Debug = require('debug');
const {hasExpression, isSupportedScriptType} = require('./utils');

module.exports = Parameter;

function Parameter(parm, environment) {
  const {name, $type: type, value, definition} = parm;
  const valueType = getValueType();
  const debugType = `type <${name}> ${valueType}`;

  const {resolveExpression, executeScript} = environment;

  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);

  debug(`init ${type} <${name}> as type ${valueType}`);

  let script, scriptName;
  if (valueType === 'script') {
    const {scriptFormat} = definition;
    if (!isSupportedScriptType(scriptFormat)) throw new Error(`${scriptFormat} is unsupported`);

    script = definition.value;
    scriptName = `${name}.io`;
  }

  const entries = getEntries(parm);

  return {
    name,
    type,
    valueType,
    activate
  };

  function activate(inputContext) {
    const activatedEntries = activateEntries();
    let resultValue;

    return {
      name,
      valueType,
      get,
      resolve,
      save,
      set
    };

    function get() {
      if (resultValue !== undefined) return resultValue;
      resultValue = internalGet(inputContext);
      return resultValue;
    }

    function set(invalue) {
      resultValue = invalue;
    }

    function resolve(from) {
      debug(`resolve ${debugType} value`);
      return internalGet(from);
    }

    function internalGet(from) {
      debug(`get ${debugType} value`);
      switch (valueType) {
        case 'constant':
          return value;
        case 'expression':
          return resolveExpression(value, from);
        case 'script':
          debug(`execute <${name}> script`);
          return executeScript(scriptName, script, from);
        case 'map':
          return getMap();
        case 'list':
          return getList();
        default:
          return getNamedValue(from);
      }
    }

    function save() {
      debug('save', debugType, 'value');
      environment.setOutputValue(name, get());
    }

    function getMap() {
      if (!activatedEntries) return getNamedValue();

      return activatedEntries.reduce((result, entry) => {
        result[entry.name] = entry.get();
        return result;
      }, {});
    }

    function getNamedValue(from) {
      from = from || inputContext;
      let result = from[name];
      if (result === undefined && from.variables) {
        result = from.variables[name];
      }
      return result;
    }

    function getList() {
      if (!activatedEntries) return getNamedValue();
      return activatedEntries.map((entry) => {
        return entry.get();
      });
    }

    function activateEntries() {
      if (!entries) return;
      return entries.map((entry) => entry.activate(inputContext));
    }
  }

  function getValueType() {
    if (value) {
      return hasExpression(value) ? 'expression' : 'constant';
    }
    if (definition && definition.$type) {
      return parm.definition.$type.replace('camunda:', '').toLowerCase();
    }
    return 'named';
  }

  function getEntries() {
    if (!definition) return;

    let parmEntries;
    if (definition.entries) {
      parmEntries = definition.entries.map((entry) => {
        return Parameter(Object.assign({name: entry.key, $type: `${type}:map`}, entry), environment);
      });
    } else if (definition.items) {
      parmEntries = definition.items.map((entry, idx) => {
        return Parameter(Object.assign({name: idx, $type: `${type}:list`}, entry), environment);
      });
    }

    return parmEntries;
  }
}
