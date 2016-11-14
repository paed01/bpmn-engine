'use strict';

const debug = require('debug')('bpmn-engine:expression');
const expressionPattern = /\${(.*)}/;
const propertyPattern = /(?:^|\.)(\w+(\(.*?\))|\w+(\[.*?\])|\w+)/g;
const propertyBracketPattern = /^(.+)\[(.+)\]$/;
const propertyFunctionPattern = /^(.+)\((.*)\)$/;

function resolveExpressions(templatedString, context) {
  let result = templatedString;
  while (expressionPattern.test(result)) {
    const expressionMatch = result.match(expressionPattern);
    const contextValue = resolvePropertyValue(expressionMatch[1], context);

    if (expressionMatch.input === expressionMatch[0]) {
      return contextValue;
    }

    result = result.replace(expressionMatch[0], contextValue === undefined ? '' : contextValue);
  }
  return result;
}

function resolvePropertyValue(propertyPath, context, defaultValue) {
  debug('resolve', propertyPath);

  const properties = propertyPath.match(propertyPattern);
  const resultValue = properties.reduce((result, property) => {
    if (result === undefined) return;

    property = property.replace(/^\./, '');

    let callArguments = [];
    const functionMatch = property.match(propertyFunctionPattern);
    if (functionMatch) {
      property = functionMatch[1];
      if (functionMatch[2] !== '') {
        callArguments = callArguments.concat(functionMatch[2].split(','));
      }
    }

    const propertyValue = result[property];
    if (propertyValue && functionMatch) {
      callArguments = callArguments.map((argument) => {
        return resolvePropertyValue(argument, context, argument);
      });
      callArguments.push(context);
      return propertyValue.apply(null, callArguments);
    }

    const bracketMatch = property.match(propertyBracketPattern);
    if (bracketMatch) {
      return result[bracketMatch[1]][bracketMatch[2]];
    }

    return propertyValue;
  }, context);

  return resultValue !== undefined ? resultValue : defaultValue;
}

module.exports = resolveExpressions;
