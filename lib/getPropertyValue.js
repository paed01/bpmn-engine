'use strict';

const propertyPattern = /(\w+)\((.*?)(?:\))|(\.|\[|^)(.+?)(?:\]|\[|\.|$)/;
const stringConstantPattern = /^['"](.*)['"]$/;
const negativeIndexPattern = /^-\d+$/;

function getPropertyValue(obj, propertyPath, defaultValue) {
  if (!obj) return defaultValue;

  let resultValue;
  let next = iterateProps(obj, obj, propertyPath);
  while (next) {
    resultValue = next.getResult();
    next = next();
  }
  return resultValue !== undefined ? resultValue : defaultValue;
}

function iterateProps(base, obj, propertyPath) {
  let result;

  const rest = propertyPath.replace(propertyPattern, (match, fnName, args, p, prop) => {
    if (fnName) {
      result = executeFn(getNamedValue(obj, fnName), args, base);
    } else {
      result = getNamedValue(obj, prop);
    }
    return '';
  });

  if (rest === propertyPath) return;
  if (result === undefined) return;

  const next = iterateProps.bind(null, base, result, rest);
  next.getResult = () => {
    if (rest !== '') return;
    return result;
  };

  return next;
}

function executeFn(fn, args, base) {
  if (!fn) return;

  let callArguments = [];
  if (args) {
    callArguments = callArguments.concat(args.split(','));
    callArguments = callArguments.map((argument) => {
      return getFunctionArgument(base, argument, argument);
    });
  } else {
    callArguments.push(base);
  }

  return fn.apply(null, callArguments);
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
