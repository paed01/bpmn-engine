'use strict';

const debug = require('debug')('bpmn-engine:io:parameter');
const expressions = require('./expressions');
const scriptHelper = require('./script-helper');

function Parameter(ioParm) {
  const parm = ioParm;
  const name = parm.name;
  const type = parm.$type;
  const valueType = getValueType();

  debug('init', type, `<${name}>`, `as type ${valueType}`);

  let script;
  if (valueType === 'script') {
    if (!scriptHelper.isJavascript(parm.definition.scriptFormat)) throw new Error(`Script format ${parm.definition.scriptFormat} is unsupported (${name})`);
    script = scriptHelper.parse(`${name}.io`, parm.definition.value);
  }

  const entries = getEntries(parm);

  function getValueType() {
    if (parm.value) {
      return expressions.hasExpression(parm.value) ? 'expression' : 'constant';
    }
    if (parm.definition && parm.definition.$type) {
      return parm.definition.$type.replace('camunda:', '').toLowerCase();
    }
    return 'named';
  }

  function getMap(message, variablesAndServices) {
    if (!entries) return getNamedValue(message, variablesAndServices);

    return entries.reduce((result, entry) => {
      result[entry.name] = entry.getInputValue(message, variablesAndServices);
      return result;
    }, {});
  }

  function getList(message, variablesAndServices) {
    if (!entries) return getNamedValue(message, variablesAndServices);

    return parm.definition.items.map((entry) => {
      return expressions.hasExpression(entry.value) ? expressions(entry.value, Object.assign({}, message, variablesAndServices)) : entry.value;
    }, {});
  }

  function getValue(message, variablesAndServices) {
    debug('get', type, `<${name}>`, valueType, 'value');

    switch (valueType) {
      case 'constant':
        return parm.value;
      case 'expression':
        return expressions(parm.value, Object.assign({}, variablesAndServices, message));
      case 'script':
        debug('execute', `<${name}>`, 'script');
        return scriptHelper.execute(script, variablesAndServices, message);
      case 'map':
        return getMap(message, variablesAndServices);
      case 'list':
        return getList(message, variablesAndServices);
      default:
        return getNamedValue(message, variablesAndServices);
    }
  }

  function getNamedValue(message, variablesAndServices) {
    if (message && message[parm.name]) {
      return message[parm.name];
    }
    if (variablesAndServices) {
      return variablesAndServices.variables[parm.name];
    }
  }

  function getOutputValue(resultValue, variablesAndServices) {
    const resultType = Array.isArray(resultValue) ? 'array' : typeof resultValue;

    switch (resultType) {
      case 'object':
      case 'function':
        return getValue(resultValue, variablesAndServices);
      default:
        return getValue({
          result: resultValue
        }, variablesAndServices);
    }
  }

  return {
    name: name,
    type: type,
    valueType: valueType,
    getInputValue: getValue,
    getOutputValue: getOutputValue
  };
}

function getEntries(parm) {
  if (!parm.definition) return;

  let entries;
  if (parm.definition.entries) {
    entries = parm.definition.entries.map((entry) => {
      return Parameter(Object.assign({name: entry.key}, entry));
    });
  } else if (parm.definition.items) {
    entries = parm.definition.items.map((entry, idx) => {
      return Parameter(Object.assign({name: idx}, entry));
    });
  }

  return entries;
}

module.exports = Parameter;
