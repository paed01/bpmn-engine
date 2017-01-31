'use strict';

const getPropertyValue = require('./getPropertyValue');

const isExpressionPattern = /^\${(.+)}$/;
const expressionPattern = /\${(.+)}/;

function resolveExpressions(templatedString, context) {
  let result = templatedString;
  while (expressionPattern.test(result)) {
    const expressionMatch = result.match(expressionPattern);
    const innerProperty = expressionMatch[1];

    if (innerProperty === 'true') {
      return true;
    } else if (innerProperty === 'false') {
      return false;
    }

    const contextValue = getPropertyValue(context, innerProperty);

    if (expressionMatch.input === expressionMatch[0]) {
      return contextValue;
    }

    result = result.replace(expressionMatch[0], contextValue === undefined ? '' : contextValue);
  }
  return result;
}

resolveExpressions.isExpression = function(text) {
  if (!text) return false;
  return isExpressionPattern.test(text);
};

resolveExpressions.hasExpression = function(text) {
  if (!text) return false;
  return expressionPattern.test(text);
};

module.exports = resolveExpressions;
