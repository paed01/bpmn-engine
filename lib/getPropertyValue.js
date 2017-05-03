'use strict';

const propertyPattern = /(?:^|\.)((\w+(\(.*?\)))|\w+(\[.*?\])|\[.+?\]|\w+)/g;
const bracketPattern = /^\[(.+)\]$/;
const chainedBracketPattern = /^(.+)\[(.+)\]$/;
const propertyFunctionPattern = /^(.+)\((.*)\)$/;
const stringConstantPattern = /^['"](.*)['"]$/;
const negativeIndexPattern = /^-\d+$/;

function getPropertyValue(obj, propertyPath, defaultValue) {
  if (!obj) return defaultValue;

  const properties = propertyPath.match(propertyPattern);
  const resultValue = properties.reduce((result, property) => {
    if (result === undefined) return;

    property = property.replace(/^\./, '');

    const bracketsMatch = property.match(bracketPattern);
    if (bracketsMatch) {
      property = bracketsMatch[1];
    }

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
        return getFunctionArgument(obj, argument, argument);
      });
      callArguments.push(obj);
      return propertyValue.apply(null, callArguments);
    }

    const chainedBracketMatch = property.match(chainedBracketPattern);
    if (chainedBracketMatch) {
      return getNamedValue(result[chainedBracketMatch[1]], chainedBracketMatch[2]);
    }

    return propertyValue;
  }, obj);

  return resultValue !== undefined ? resultValue : defaultValue;
}

function getFunctionArgument(obj, argument, defaultValue) {
  const stringMatch = argument.match(stringConstantPattern);
  if (stringMatch) {
    return stringMatch[1];
  }
  return getPropertyValue(obj, argument, defaultValue);
}

function getNamedValue(obj, property) {
  if (Array.isArray(obj)) {
    return getArrayItem(obj, property);
  }
  return obj[property];
}

function getArrayItem(list, idx) {
  if (negativeIndexPattern.test(idx)) {
    const nidx = Number(idx);
    const aidx = nidx === 0 ? 0 : list.length + nidx;
    return list[aidx];
  }
  return list[idx];
}

module.exports = getPropertyValue;
